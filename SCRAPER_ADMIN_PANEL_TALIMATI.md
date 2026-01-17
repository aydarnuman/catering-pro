# 🖥️ SCRAPER DASHBOARD - ADMIN PANEL TALİMATI

## 📋 ÖZET

Bu döküman, Catering Pro admin paneline Scraper Dashboard sayfası eklenmesi için Cursor AI'a verilecek talimatları içerir.

---

## 🎯 HEDEF

Admin panelde scraper durumunu izleyebilecek bir dashboard oluşturmak:

1. **Sistem Durumu** - Circuit breaker, son çalışma zamanı
2. **İstatistikler** - Başarılı/başarısız işlem sayıları
3. **Job Queue** - Bekleyen, işlenen, başarısız job'lar
4. **Loglar** - Son hata ve uyarı logları
5. **Kontroller** - Manuel tetikleme, reset, retry butonları

---

## 📁 OLUŞTURULACAK DOSYALAR

### Backend (API Routes)

```
backend/src/routes/scraper.js          → API endpoint'leri
```

### Frontend (UI)

```
frontend/src/app/admin/scraper/page.tsx → Dashboard sayfası
```

---

## 🔌 BACKEND API ENDPOINT'LERİ

**Dosya:** `backend/src/routes/scraper.js`

```javascript
/**
 * ============================================================================
 * SCRAPER API ROUTES
 * ============================================================================
 * 
 * Admin panel için scraper yönetim endpoint'leri
 * 
 * Endpoints:
 * - GET  /api/scraper/health     → Circuit breaker durumu
 * - GET  /api/scraper/stats      → Queue istatistikleri
 * - GET  /api/scraper/jobs       → Job listesi
 * - GET  /api/scraper/logs       → Son loglar
 * - POST /api/scraper/trigger    → Manuel scraping başlat
 * - POST /api/scraper/reset      → Circuit breaker sıfırla
 * - POST /api/scraper/retry      → Başarısız job'ları tekrar dene
 * - POST /api/scraper/cancel     → Bekleyen job'ları iptal et
 */

import express from 'express';
import { query } from '../database.js';

const router = express.Router();

// ============================================================================
// HEALTH & STATUS
// ============================================================================

/**
 * GET /api/scraper/health
 * Circuit breaker ve sistem durumu
 */
router.get('/health', async (req, res) => {
  try {
    // scraper_health tablosundan durum al
    const healthResult = await query(`
      SELECT 
        status,
        failure_count,
        success_count,
        failure_threshold,
        last_success_at,
        last_failure_at,
        cooldown_until,
        stats,
        updated_at
      FROM scraper_health 
      WHERE source = 'ihalebul'
    `);
    
    const health = healthResult.rows[0] || {
      status: 'unknown',
      failure_count: 0,
      success_count: 0
    };
    
    // Cooldown kalan süre hesapla
    let cooldownRemaining = null;
    if (health.cooldown_until) {
      const remaining = new Date(health.cooldown_until) - new Date();
      if (remaining > 0) {
        cooldownRemaining = Math.ceil(remaining / 1000);
      }
    }
    
    res.json({
      success: true,
      data: {
        status: health.status,
        statusText: getStatusText(health.status),
        failureCount: health.failure_count,
        successCount: health.success_count,
        failureThreshold: health.failure_threshold,
        lastSuccess: health.last_success_at,
        lastFailure: health.last_failure_at,
        cooldownUntil: health.cooldown_until,
        cooldownRemaining,
        stats: health.stats,
        updatedAt: health.updated_at,
        isHealthy: health.status === 'healthy',
        canExecute: health.status !== 'open' || !cooldownRemaining
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/scraper/stats
 * Queue istatistikleri
 */
router.get('/stats', async (req, res) => {
  try {
    // Genel istatistikler
    const summaryResult = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM scraper_jobs
      GROUP BY status
    `);
    
    const summary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retry_pending: 0,
      cancelled: 0,
      total: 0
    };
    
    for (const row of summaryResult.rows) {
      summary[row.status] = parseInt(row.count);
      summary.total += parseInt(row.count);
    }
    
    // Son 24 saat
    const last24hResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(duration_ms) FILTER (WHERE status = 'completed') as avg_duration
      FROM scraper_jobs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    
    const last24h = last24hResult.rows[0] || {};
    
    // Son 7 gün trend
    const trendResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM scraper_jobs
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    // Son scraping bilgisi
    const lastRunResult = await query(`
      SELECT 
        created_at,
        completed_at,
        duration_ms,
        result
      FROM scraper_jobs
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `);
    
    res.json({
      success: true,
      data: {
        summary,
        last24h: {
          completed: parseInt(last24h.completed) || 0,
          failed: parseInt(last24h.failed) || 0,
          avgDuration: Math.round(last24h.avg_duration) || 0
        },
        trend: trendResult.rows,
        lastRun: lastRunResult.rows[0] || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// JOB LİSTESİ
// ============================================================================

/**
 * GET /api/scraper/jobs
 * Job listesi (filtrelenebilir)
 * Query params: status, limit, offset
 */
router.get('/jobs', async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT 
        j.id,
        j.job_type,
        j.external_id,
        j.tender_url,
        j.status,
        j.priority,
        j.retry_count,
        j.max_retries,
        j.error_message,
        j.created_at,
        j.started_at,
        j.completed_at,
        j.duration_ms,
        t.title as tender_title
      FROM scraper_jobs j
      LEFT JOIN tenders t ON j.tender_id = t.id
    `;
    
    const params = [];
    
    if (status) {
      params.push(status);
      sql += ` WHERE j.status = $${params.length}`;
    }
    
    sql += ` ORDER BY j.created_at DESC`;
    sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await query(sql, params);
    
    // Toplam sayı
    let countSql = 'SELECT COUNT(*) FROM scraper_jobs';
    if (status) {
      countSql += ` WHERE status = $1`;
    }
    const countResult = await query(countSql, status ? [status] : []);
    
    res.json({
      success: true,
      data: {
        jobs: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LOGLAR
// ============================================================================

/**
 * GET /api/scraper/logs
 * Son loglar
 * Query params: level, module, limit
 */
router.get('/logs', async (req, res) => {
  try {
    const { level, module, limit = 100 } = req.query;
    
    let sql = `
      SELECT 
        id,
        level,
        module,
        message,
        context,
        session_id,
        created_at
      FROM scraper_logs
      WHERE 1=1
    `;
    
    const params = [];
    
    if (level) {
      params.push(level);
      sql += ` AND level = $${params.length}::log_level`;
    }
    
    if (module) {
      params.push(`%${module}%`);
      sql += ` AND module ILIKE $${params.length}`;
    }
    
    sql += ` ORDER BY created_at DESC`;
    sql += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const result = await query(sql, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// KONTROL İŞLEMLERİ
// ============================================================================

/**
 * POST /api/scraper/reset
 * Circuit breaker'ı sıfırla
 */
router.post('/reset', async (req, res) => {
  try {
    await query(`
      UPDATE scraper_health SET
        status = 'healthy',
        failure_count = 0,
        success_count = 0,
        cooldown_until = NULL,
        updated_at = NOW()
      WHERE source = 'ihalebul'
    `);
    
    // Log kaydet
    await query(`
      INSERT INTO scraper_logs (level, module, message, context)
      VALUES ('WARN', 'AdminPanel', 'Circuit breaker manuel olarak sıfırlandı', $1)
    `, [JSON.stringify({ action: 'reset', user: 'admin' })]);
    
    res.json({ 
      success: true, 
      message: 'Circuit breaker sıfırlandı' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/retry
 * Başarısız job'ları tekrar kuyruğa al
 */
router.post('/retry', async (req, res) => {
  try {
    const { limit = 50 } = req.body;
    
    const result = await query(`
      UPDATE scraper_jobs SET
        status = 'pending',
        retry_count = 0,
        next_retry_at = NULL,
        error_message = NULL,
        error_details = NULL,
        completed_at = NULL
      WHERE status = 'failed'
      AND id IN (
        SELECT id FROM scraper_jobs 
        WHERE status = 'failed'
        LIMIT $1
      )
    `, [limit]);
    
    // Log kaydet
    await query(`
      INSERT INTO scraper_logs (level, module, message, context)
      VALUES ('INFO', 'AdminPanel', 'Başarısız job''lar yeniden kuyruğa alındı', $1)
    `, [JSON.stringify({ count: result.rowCount, action: 'retry' })]);
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} job yeniden kuyruğa alındı`,
      count: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/cancel
 * Bekleyen job'ları iptal et
 */
router.post('/cancel', async (req, res) => {
  try {
    const result = await query(`
      UPDATE scraper_jobs SET
        status = 'cancelled',
        completed_at = NOW()
      WHERE status IN ('pending', 'retry_pending')
    `);
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} job iptal edildi`,
      count: result.rowCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/scraper/cleanup
 * Eski verileri temizle
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 7 } = req.body;
    
    // Eski job'ları sil
    const jobsResult = await query(`
      DELETE FROM scraper_jobs
      WHERE status IN ('completed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '${days} days'
    `);
    
    // Eski logları sil
    const logsResult = await query(`
      DELETE FROM scraper_logs
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    
    res.json({ 
      success: true, 
      message: 'Temizlik tamamlandı',
      deletedJobs: jobsResult.rowCount,
      deletedLogs: logsResult.rowCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// HELPER
// ============================================================================

function getStatusText(status) {
  const texts = {
    healthy: 'Sistem normal çalışıyor',
    degraded: 'Sistem sorunlu ama çalışıyor',
    open: 'Devre açık - istekler engelleniyor',
    half_open: 'Test aşaması - tek istek deneniyor'
  };
  return texts[status] || status;
}

export default router;
```

**server.js'e ekle:**
```javascript
import scraperRoutes from './routes/scraper.js';

// Diğer route'lardan sonra ekle
app.use('/api/scraper', scraperRoutes);
```

---

## 🖥️ FRONTEND DASHBOARD

**Dosya:** `frontend/src/app/admin/scraper/page.tsx`

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
  Badge,
  Button,
  Paper,
  Table,
  ActionIcon,
  Tooltip,
  Loader,
  Alert,
  Progress,
  SegmentedControl,
  ScrollArea,
  Code,
  Modal,
  Tabs,
  RingProgress,
  Center
} from '@mantine/core';
import {
  IconRefresh,
  IconCheck,
  IconX,
  IconArrowLeft,
  IconActivity,
  IconClock,
  IconPlayerPlay,
  IconPlayerStop,
  IconRotateClockwise,
  IconTrash,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconLoader,
  IconClockPause,
  IconBug,
  IconChartBar,
  IconList,
  IconFileText
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

// ============================================================================
// TYPES
// ============================================================================

interface HealthData {
  status: 'healthy' | 'degraded' | 'open' | 'half_open';
  statusText: string;
  failureCount: number;
  successCount: number;
  failureThreshold: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  cooldownUntil: string | null;
  cooldownRemaining: number | null;
  isHealthy: boolean;
  canExecute: boolean;
}

interface StatsData {
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retry_pending: number;
    cancelled: number;
    total: number;
  };
  last24h: {
    completed: number;
    failed: number;
    avgDuration: number;
  };
  trend: Array<{ date: string; completed: number; failed: number }>;
  lastRun: {
    created_at: string;
    completed_at: string;
    duration_ms: number;
  } | null;
}

interface Job {
  id: number;
  job_type: string;
  external_id: string;
  tender_url: string;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  tender_title: string | null;
}

interface LogEntry {
  id: number;
  level: string;
  module: string;
  message: string;
  context: any;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ScraperDashboardPage() {
  const API_URL = API_BASE_URL;
  
  // State
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [logLevel, setLogLevel] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/scraper/health`);
      const data = await res.json();
      if (data.success) setHealth(data.data);
    } catch (err) {
      console.error('Health fetch error:', err);
    }
  }, [API_URL]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/scraper/stats`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  }, [API_URL]);

  const fetchJobs = useCallback(async () => {
    try {
      const statusParam = jobFilter !== 'all' ? `?status=${jobFilter}` : '';
      const res = await fetch(`${API_URL}/api/scraper/jobs${statusParam}&limit=50`);
      const data = await res.json();
      if (data.success) setJobs(data.data.jobs);
    } catch (err) {
      console.error('Jobs fetch error:', err);
    }
  }, [API_URL, jobFilter]);

  const fetchLogs = useCallback(async () => {
    try {
      const levelParam = logLevel !== 'all' ? `?level=${logLevel}` : '';
      const res = await fetch(`${API_URL}/api/scraper/logs${levelParam}&limit=100`);
      const data = await res.json();
      if (data.success) setLogs(data.data);
    } catch (err) {
      console.error('Logs fetch error:', err);
    }
  }, [API_URL, logLevel]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHealth(), fetchStats(), fetchJobs(), fetchLogs()]);
    setLoading(false);
  }, [fetchHealth, fetchStats, fetchJobs, fetchLogs]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, []);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 30000); // 30 saniye
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  // Filter değişince tekrar fetch
  useEffect(() => {
    fetchJobs();
  }, [jobFilter]);

  useEffect(() => {
    fetchLogs();
  }, [logLevel]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleAction = async (action: string, body?: any) => {
    setActionLoading(action);
    try {
      const res = await fetch(`${API_URL}/api/scraper/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json();
      
      if (data.success) {
        notifications.show({
          title: 'Başarılı',
          message: data.message,
          color: 'green',
          icon: <IconCheck size={16} />
        });
        fetchAll();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      notifications.show({
        title: 'Hata',
        message: err.message,
        color: 'red',
        icon: <IconX size={16} />
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      healthy: 'green',
      degraded: 'yellow',
      open: 'red',
      half_open: 'orange',
      pending: 'blue',
      processing: 'cyan',
      completed: 'green',
      failed: 'red',
      retry_pending: 'orange',
      cancelled: 'gray'
    };
    return colors[status] || 'gray';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, any> = {
      healthy: IconCircleCheck,
      degraded: IconAlertTriangle,
      open: IconCircleX,
      half_open: IconLoader,
      pending: IconClock,
      processing: IconLoader,
      completed: IconCircleCheck,
      failed: IconCircleX,
      retry_pending: IconRotateClockwise,
      cancelled: IconPlayerStop
    };
    const Icon = icons[status] || IconCircleCheck;
    return <Icon size={16} />;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('tr-TR');
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLogLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      DEBUG: 'gray',
      INFO: 'blue',
      WARN: 'yellow',
      ERROR: 'red',
      FATAL: 'grape'
    };
    return colors[level] || 'gray';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={400}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" size="lg" component="a" href="/admin">
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={1} size="h2" mb={4}>🕷️ Scraper Dashboard</Title>
              <Text c="dimmed">İhale scraper durumu, istatistikler ve yönetim</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant={autoRefresh ? 'filled' : 'light'}
              color={autoRefresh ? 'green' : 'gray'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              leftSection={<IconActivity size={16} />}
            >
              {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme'}
            </Button>
            <Button
              variant="light"
              size="sm"
              onClick={fetchAll}
              leftSection={<IconRefresh size={16} />}
            >
              Yenile
            </Button>
          </Group>
        </Group>

        {/* Durum Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {/* Circuit Breaker */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Circuit Breaker</Text>
              <ThemeIcon 
                variant="light" 
                color={getStatusColor(health?.status || 'unknown')}
                size="lg"
              >
                {getStatusIcon(health?.status || 'unknown')}
              </ThemeIcon>
            </Group>
            <Badge 
              color={getStatusColor(health?.status || 'unknown')} 
              size="lg" 
              fullWidth
            >
              {health?.status?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <Text size="xs" c="dimmed" mt="xs">
              {health?.statusText}
            </Text>
            {health?.cooldownRemaining && (
              <Text size="xs" c="orange" mt="xs">
                ⏳ Kalan: {health.cooldownRemaining}s
              </Text>
            )}
          </Card>

          {/* Son Çalışma */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Son Başarılı</Text>
              <ThemeIcon variant="light" color="green" size="lg">
                <IconClock size={18} />
              </ThemeIcon>
            </Group>
            <Text size="sm" fw={500}>
              {formatDate(health?.lastSuccess)}
            </Text>
            {stats?.lastRun && (
              <Text size="xs" c="dimmed" mt="xs">
                Süre: {formatDuration(stats.lastRun.duration_ms)}
              </Text>
            )}
          </Card>

          {/* Hata Sayacı */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Hata Sayacı</Text>
              <ThemeIcon variant="light" color="red" size="lg">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs">
              <Text size="xl" fw={700} c="red">{health?.failureCount || 0}</Text>
              <Text size="sm" c="dimmed">/ {health?.failureThreshold || 5}</Text>
            </Group>
            <Progress 
              value={((health?.failureCount || 0) / (health?.failureThreshold || 5)) * 100} 
              color="red" 
              size="sm" 
              mt="xs"
            />
          </Card>

          {/* Queue Durumu */}
          <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Queue</Text>
              <ThemeIcon variant="light" color="blue" size="lg">
                <IconList size={18} />
              </ThemeIcon>
            </Group>
            <Group gap="xs">
              <Badge color="blue" variant="light">{stats?.summary.pending || 0} Bekleyen</Badge>
              <Badge color="cyan" variant="light">{stats?.summary.processing || 0} İşlenen</Badge>
            </Group>
            <Text size="xs" c="dimmed" mt="xs">
              Toplam: {stats?.summary.total || 0} job
            </Text>
          </Card>
        </SimpleGrid>

        {/* İstatistik Kartları */}
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {/* Son 24 Saat */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">📊 Son 24 Saat</Title>
            <Group justify="center" mb="md">
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  { value: stats?.last24h.completed || 0, color: 'green' },
                  { value: stats?.last24h.failed || 0, color: 'red' },
                ]}
                label={
                  <Center>
                    <Text size="lg" fw={700}>
                      {(stats?.last24h.completed || 0) + (stats?.last24h.failed || 0)}
                    </Text>
                  </Center>
                }
              />
            </Group>
            <Group justify="center" gap="xl">
              <div style={{ textAlign: 'center' }}>
                <Text size="xl" fw={700} c="green">{stats?.last24h.completed || 0}</Text>
                <Text size="xs" c="dimmed">Başarılı</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text size="xl" fw={700} c="red">{stats?.last24h.failed || 0}</Text>
                <Text size="xs" c="dimmed">Başarısız</Text>
              </div>
            </Group>
          </Paper>

          {/* Queue Özeti */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">📋 Queue Özeti</Title>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm">Bekleyen</Text>
                <Badge color="blue">{stats?.summary.pending || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">İşleniyor</Text>
                <Badge color="cyan">{stats?.summary.processing || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Retry Bekleyen</Text>
                <Badge color="orange">{stats?.summary.retry_pending || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Tamamlanan</Text>
                <Badge color="green">{stats?.summary.completed || 0}</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Başarısız</Text>
                <Badge color="red">{stats?.summary.failed || 0}</Badge>
              </Group>
            </Stack>
          </Paper>

          {/* Kontroller */}
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">🎮 Kontroller</Title>
            <Stack gap="sm">
              <Button
                variant="light"
                color="green"
                fullWidth
                leftSection={<IconRotateClockwise size={16} />}
                loading={actionLoading === 'retry'}
                onClick={() => handleAction('retry', { limit: 50 })}
                disabled={!stats?.summary.failed}
              >
                Başarısızları Tekrar Dene ({stats?.summary.failed || 0})
              </Button>
              <Button
                variant="light"
                color="orange"
                fullWidth
                leftSection={<IconRefresh size={16} />}
                loading={actionLoading === 'reset'}
                onClick={() => handleAction('reset')}
                disabled={health?.status === 'healthy'}
              >
                Circuit Breaker Sıfırla
              </Button>
              <Button
                variant="light"
                color="red"
                fullWidth
                leftSection={<IconPlayerStop size={16} />}
                loading={actionLoading === 'cancel'}
                onClick={() => handleAction('cancel')}
                disabled={!stats?.summary.pending}
              >
                Bekleyenleri İptal Et ({stats?.summary.pending || 0})
              </Button>
              <Button
                variant="light"
                color="gray"
                fullWidth
                leftSection={<IconTrash size={16} />}
                loading={actionLoading === 'cleanup'}
                onClick={() => handleAction('cleanup', { days: 7 })}
              >
                Eski Verileri Temizle
              </Button>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Tabs: Jobs & Logs */}
        <Paper p="lg" radius="md" withBorder>
          <Tabs defaultValue="jobs">
            <Tabs.List>
              <Tabs.Tab value="jobs" leftSection={<IconList size={16} />}>
                Job Listesi
              </Tabs.Tab>
              <Tabs.Tab value="logs" leftSection={<IconFileText size={16} />}>
                Loglar
              </Tabs.Tab>
            </Tabs.List>

            {/* Jobs Tab */}
            <Tabs.Panel value="jobs" pt="md">
              <Group justify="space-between" mb="md">
                <SegmentedControl
                  value={jobFilter}
                  onChange={setJobFilter}
                  data={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Bekleyen', value: 'pending' },
                    { label: 'İşleniyor', value: 'processing' },
                    { label: 'Başarısız', value: 'failed' },
                    { label: 'Tamamlanan', value: 'completed' },
                  ]}
                  size="xs"
                />
                <Button size="xs" variant="subtle" onClick={fetchJobs}>
                  <IconRefresh size={14} />
                </Button>
              </Group>

              <ScrollArea h={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>ID</Table.Th>
                      <Table.Th>İhale</Table.Th>
                      <Table.Th>Durum</Table.Th>
                      <Table.Th>Retry</Table.Th>
                      <Table.Th>Süre</Table.Th>
                      <Table.Th>Tarih</Table.Th>
                      <Table.Th>Hata</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {jobs.map((job) => (
                      <Table.Tr key={job.id}>
                        <Table.Td>#{job.id}</Table.Td>
                        <Table.Td>
                          <Tooltip label={job.tender_title || job.tender_url}>
                            <Text size="sm" lineClamp={1} style={{ maxWidth: 200 }}>
                              {job.external_id}
                            </Text>
                          </Tooltip>
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={getStatusColor(job.status)} 
                            size="sm"
                            leftSection={getStatusIcon(job.status)}
                          >
                            {job.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {job.retry_count}/{job.max_retries}
                        </Table.Td>
                        <Table.Td>{formatDuration(job.duration_ms)}</Table.Td>
                        <Table.Td>
                          <Text size="xs">{formatDate(job.created_at)}</Text>
                        </Table.Td>
                        <Table.Td>
                          {job.error_message && (
                            <Tooltip label={job.error_message}>
                              <Badge color="red" size="xs">Hata</Badge>
                            </Tooltip>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Tabs.Panel>

            {/* Logs Tab */}
            <Tabs.Panel value="logs" pt="md">
              <Group justify="space-between" mb="md">
                <SegmentedControl
                  value={logLevel}
                  onChange={setLogLevel}
                  data={[
                    { label: 'Tümü', value: 'all' },
                    { label: 'Debug', value: 'DEBUG' },
                    { label: 'Info', value: 'INFO' },
                    { label: 'Warn', value: 'WARN' },
                    { label: 'Error', value: 'ERROR' },
                  ]}
                  size="xs"
                />
                <Button size="xs" variant="subtle" onClick={fetchLogs}>
                  <IconRefresh size={14} />
                </Button>
              </Group>

              <ScrollArea h={400}>
                <Stack gap="xs">
                  {logs.map((log) => (
                    <Paper key={log.id} p="xs" withBorder>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Badge color={getLogLevelColor(log.level)} size="xs">
                            {log.level}
                          </Badge>
                          <Badge variant="outline" size="xs">
                            {log.module}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {formatDate(log.created_at)}
                        </Text>
                      </Group>
                      <Text size="sm">{log.message}</Text>
                      {log.context && Object.keys(log.context).length > 0 && (
                        <Code block mt="xs" style={{ fontSize: 11 }}>
                          {JSON.stringify(log.context, null, 2)}
                        </Code>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>
    </Container>
  );
}
```

---

## 🔗 ADMIN MENÜYE EKLEME

Admin ana sayfasına scraper linki ekle:

**Dosya:** `frontend/src/app/admin/page.tsx`

Mevcut menü kartlarına ekle:
```tsx
{
  title: 'Scraper Dashboard',
  description: 'İhale scraper durumu ve yönetimi',
  icon: IconBug, // veya IconSpider
  href: '/admin/scraper',
  color: 'grape'
}
```

---

## 📊 DASHBOARD ÖN İZLEME

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🕷️ Scraper Dashboard                           [Otomatik Yenileme] [↻] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │ Circuit Breaker│ │  Son Başarılı  │ │  Hata Sayacı   │ │   Queue    │ │
│  │                │ │                │ │                │ │            │ │
│  │   🟢 HEALTHY   │ │ 17.01.2026     │ │    0 / 5       │ │ 3 Bekleyen │ │
│  │                │ │ 14:32:15       │ │ ████░░░░░░     │ │ 1 İşlenen  │ │
│  │ Sistem normal  │ │ Süre: 45.2s    │ │                │ │            │ │
│  └────────────────┘ └────────────────┘ └────────────────┘ └────────────┘ │
│                                                                          │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ │
│  │   📊 Son 24 Saat    │ │   📋 Queue Özeti    │ │    🎮 Kontroller    │ │
│  │                     │ │                     │ │                     │ │
│  │      ╭───╮          │ │ Bekleyen      [12]  │ │ [Başarısızları     ]│ │
│  │     ╱ 156 ╲         │ │ İşleniyor      [2]  │ │ [Tekrar Dene    (5)]│ │
│  │    ╱  job  ╲        │ │ Retry          [3]  │ │                     │ │
│  │    ╲       ╱        │ │ Tamamlanan   [148]  │ │ [Circuit Breaker   ]│ │
│  │     ╲─────╱         │ │ Başarısız      [5]  │ │ [Sıfırla           ]│ │
│  │                     │ │                     │ │                     │ │
│  │   ✅ 151  ❌ 5      │ │                     │ │ [Bekleyenleri İptal]│ │
│  └─────────────────────┘ └─────────────────────┘ └─────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ [Job Listesi]  [Loglar]                                            │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ [Tümü] [Bekleyen] [İşleniyor] [Başarısız] [Tamamlanan]            │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │ ID    │ İhale      │ Durum      │ Retry │ Süre  │ Tarih   │ Hata  │  │
│  ├───────┼────────────┼────────────┼───────┼───────┼─────────┼───────┤  │
│  │ #1234 │ 2024/12345 │ 🟢completed│  0/5  │ 2.3s  │ 14:32   │       │  │
│  │ #1233 │ 2024/12344 │ 🔴failed   │  5/5  │ -     │ 14:30   │ [!]   │  │
│  │ #1232 │ 2024/12343 │ 🔵pending  │  0/5  │ -     │ 14:28   │       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## ✅ CURSOR KONTROL LİSTESİ

Cursor'a yaptırılacak işler:

- [ ] `backend/src/routes/scraper.js` oluştur
- [ ] `server.js`'e route'u ekle
- [ ] `frontend/src/app/admin/scraper/page.tsx` oluştur
- [ ] Admin ana sayfasına link ekle
- [ ] Test et

---

## 🚀 CURSOR'A VERİLECEK PROMPT

```
@SCRAPER_ADMIN_PANEL_TALIMATI.md dosyasını oku.

Admin panele scraper dashboard sayfası ekle:

1. Backend'de /api/scraper/* endpoint'lerini oluştur (scraper.js route dosyası)
2. server.js'e route'u ekle
3. Frontend'de /admin/scraper sayfasını oluştur (Mantine UI kullan)
4. Admin ana sayfasına scraper linkini ekle

Mevcut admin/sistem/page.tsx dosyasını referans al - aynı stil ve yapıyı kullan.

Dashboard'da gösterilecekler:
- Circuit breaker durumu (healthy/degraded/open)
- Son başarılı çalışma zamanı
- Hata sayacı ve eşik değeri
- Queue istatistikleri (bekleyen, işlenen, başarısız)
- Son 24 saat özeti
- Job listesi (filtrelenebilir)
- Log görüntüleme
- Kontrol butonları (reset, retry, cancel, cleanup)
```
