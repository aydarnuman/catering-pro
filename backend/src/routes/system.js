import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);
const router = express.Router();

// __dirname ES modules için
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Proje kök dizini - environment variable ile ayarlanabilir
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../..');
const WHATSAPP_SERVICE_PATH = process.env.WHATSAPP_SERVICE_PATH || path.join(PROJECT_ROOT, 'services/whatsapp');

// ==========================================
// 🔥 GOD MODE TERMINAL
// ==========================================

// Tehlikeli komut blacklist
const COMMAND_BLACKLIST = [
  /rm\s+-rf\s+\/(?!\w)/i,           // rm -rf / (root silme)
  /rm\s+-rf\s+~\s*/i,               // rm -rf ~ (home silme)
  /mkfs\./i,                        // disk format
  /dd\s+if=.*of=\/dev/i,            // disk yazma
  /shutdown/i,                      // sistem kapatma
  /init\s+0/i,                      // sistem kapatma
  /halt/i,                          // sistem durdurma
  /poweroff/i,                      // güç kapatma
  /:(){ :|:& };:/,                  // fork bomb
  />\s*\/dev\/sda/i,                // disk yazma
  /DROP\s+DATABASE\s+postgres/i,    // ana db silme
];

// Uyarı gerektiren komutlar
const WARNING_COMMANDS = [
  /rm\s+-/i,                        // rm with flags
  /DROP\s+(TABLE|DATABASE)/i,       // SQL drop
  /DELETE\s+FROM/i,                 // SQL delete
  /TRUNCATE/i,                      // SQL truncate
  /kill\s+-9/i,                     // force kill
  /pkill/i,                         // process kill
  /npm\s+uninstall/i,               // paket kaldırma
  /git\s+reset\s+--hard/i,          // git hard reset
  /git\s+push\s+--force/i,          // force push
];

// Hazır komutlar - dinamik path ile
const getPresetCommands = () => ({
  'pm2_status': { cmd: 'pm2 status', desc: 'PM2 Durumu', safe: true },
  'pm2_logs': { cmd: 'pm2 logs --lines 50 --nostream', desc: 'PM2 Logları (son 50)', safe: true },
  'disk_usage': { cmd: 'df -h', desc: 'Disk Kullanımı', safe: true },
  'memory_usage': { cmd: 'free -h 2>/dev/null || vm_stat', desc: 'Bellek Kullanımı', safe: true },
  'cpu_info': { cmd: 'top -l 1 | head -10 2>/dev/null || top -bn1 | head -10', desc: 'CPU Bilgisi', safe: true },
  'network_ports': { cmd: 'lsof -i -P | grep LISTEN | head -20', desc: 'Açık Portlar', safe: true },
  'backend_restart': { cmd: 'pm2 restart backend 2>/dev/null || echo "PM2 kullanılmıyor"', desc: 'Backend Restart', safe: false },
  'frontend_restart': { cmd: 'pm2 restart frontend 2>/dev/null || echo "PM2 kullanılmıyor"', desc: 'Frontend Restart', safe: false },
  'clear_cache': { cmd: 'rm -rf /tmp/catering-cache/* 2>/dev/null; echo "Cache temizlendi"', desc: 'Cache Temizle', safe: true },
  'git_status': { cmd: `cd ${PROJECT_ROOT} && git status`, desc: 'Git Status', safe: true },
  'git_log': { cmd: `cd ${PROJECT_ROOT} && git log --oneline -10`, desc: 'Son 10 Commit', safe: true },
  'db_size': { cmd: 'echo "DB boyutu Supabase dashboard\'dan kontrol edilmeli"', desc: 'DB Boyutu', safe: true },
  'system_uptime': { cmd: 'uptime', desc: 'Sistem Uptime', safe: true },
  'node_version': { cmd: 'node -v && npm -v', desc: 'Node/NPM Versiyonu', safe: true },
});
const PRESET_COMMANDS = getPresetCommands();

// Komut blacklist kontrolü
function isBlacklisted(command) {
  return COMMAND_BLACKLIST.some(pattern => pattern.test(command));
}

// Komut uyarı kontrolü
function needsWarning(command) {
  return WARNING_COMMANDS.some(pattern => pattern.test(command));
}

// Hazır komutları listele
router.get('/terminal/presets', authenticate, requireSuperAdmin, (req, res) => {
  const presets = Object.entries(PRESET_COMMANDS).map(([key, value]) => ({
    id: key,
    command: value.cmd,
    description: value.desc,
    safe: value.safe
  }));
  res.json({ success: true, presets });
});

// Hazır komut çalıştır
router.post('/terminal/preset/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const preset = PRESET_COMMANDS[id];
  
  if (!preset) {
    return res.status(404).json({ success: false, error: 'Komut bulunamadı' });
  }

  try {
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(preset.cmd, { 
      timeout: 30000,
      maxBuffer: 1024 * 1024 // 1MB
    });
    const duration = Date.now() - startTime;

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, description, new_data, ip_address)
      VALUES ($1, 'TERMINAL_PRESET', 'terminal', $2, $3, $4)
    `, [req.user.id, `Preset: ${preset.description}`, JSON.stringify({ preset: id, command: preset.cmd }), req.ip]);

    res.json({
      success: true,
      preset: id,
      output: stdout || stderr,
      duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: false,
      preset: id,
      error: error.message,
      output: error.stderr || error.stdout || '',
      timestamp: new Date().toISOString()
    });
  }
});

// Manuel komut çalıştır
router.post('/terminal/execute', authenticate, requireSuperAdmin, async (req, res) => {
  const { command, cwd, confirmed } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ success: false, error: 'Komut gerekli' });
  }

  // Blacklist kontrolü
  if (isBlacklisted(command)) {
    // Audit log - blocked
    await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, description, new_data, ip_address)
      VALUES ($1, 'TERMINAL_BLOCKED', 'terminal', $2, $3, $4)
    `, [req.user.id, `Engellenen komut: ${command}`, JSON.stringify({ command, reason: 'blacklisted' }), req.ip]);

    return res.status(403).json({ 
      success: false, 
      error: '🚫 Bu komut güvenlik nedeniyle engellenmiştir.',
      blocked: true
    });
  }

  // Uyarı kontrolü
  if (needsWarning(command) && !confirmed) {
    return res.json({
      success: false,
      warning: true,
      message: '⚠️ Bu komut tehlikeli olabilir. Devam etmek için onaylayın.',
      command
    });
  }

  try {
    const startTime = Date.now();
    const workDir = cwd || PROJECT_ROOT;
    
    const { stdout, stderr } = await execAsync(command, { 
      cwd: workDir,
      timeout: 60000, // 60 saniye
      maxBuffer: 2 * 1024 * 1024, // 2MB
      env: { ...process.env, TERM: 'xterm-256color' }
    });
    
    const duration = Date.now() - startTime;

    // Audit log
    await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, description, new_data, ip_address)
      VALUES ($1, 'TERMINAL_EXECUTE', 'terminal', $2, $3, $4)
    `, [req.user.id, `Komut: ${command.substring(0, 100)}`, JSON.stringify({ command, cwd: workDir, duration }), req.ip]);

    res.json({
      success: true,
      output: stdout,
      stderr: stderr || null,
      duration,
      cwd: workDir,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Audit log - error
    await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, description, new_data, ip_address)
      VALUES ($1, 'TERMINAL_ERROR', 'terminal', $2, $3, $4)
    `, [req.user.id, `Hata: ${error.message.substring(0, 100)}`, JSON.stringify({ command, error: error.message }), req.ip]);

    res.json({
      success: false,
      error: error.message,
      output: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code,
      timestamp: new Date().toISOString()
    });
  }
});

// Terminal geçmişi (son 50 komut)
router.get('/terminal/history', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, action, description, new_data as details, created_at, ip_address
      FROM audit_logs 
      WHERE user_id = $1 
        AND action IN ('TERMINAL_EXECUTE', 'TERMINAL_PRESET', 'TERMINAL_BLOCKED', 'TERMINAL_ERROR')
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json({ success: true, history: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servis durumlarını kontrol et
router.get('/services/status', async (req, res) => {
  try {
    const services = {
      whatsapp: { port: 3002, status: 'unknown', name: 'WhatsApp Service' },
      backend: { port: 3001, status: 'running', name: 'Backend API' }, // Biz zaten çalışıyoruz
      frontend: { port: 3000, status: 'unknown', name: 'Frontend' }
    };

    // WhatsApp servisi kontrolü
    try {
      const waRes = await fetch('http://localhost:3002/status', { 
        signal: AbortSignal.timeout(3000) 
      });
      const waStatus = await waRes.json();
      services.whatsapp.status = waStatus.connected ? 'connected' : 'disconnected';
      services.whatsapp.details = waStatus;
    } catch {
      services.whatsapp.status = 'offline';
    }

    // Frontend kontrolü (basit port check)
    try {
      const { stdout } = await execAsync('lsof -i :3000 | grep LISTEN | wc -l');
      services.frontend.status = parseInt(stdout.trim()) > 0 ? 'running' : 'offline';
    } catch {
      services.frontend.status = 'offline';
    }

    res.json({ success: true, services });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Tüm servisleri başlat
router.post('/services/start-all', async (req, res) => {
  try {
    const scriptPath = path.join(PROJECT_ROOT, 'start-all.sh');

    // Script'i background'da çalıştır
    exec(`bash "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        logger.error('Start script error', { error: error.message, stack: error.stack });
      }
      logger.info('Start script output', { output: stdout });
    });

    res.json({ 
      success: true, 
      message: 'Servisler başlatılıyor... Birkaç saniye bekleyin.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// WhatsApp servisini yeniden başlat
router.post('/services/restart/whatsapp', async (req, res) => {
  try {
    // Port'u kapat ve yeniden başlat
    exec(`lsof -ti:3002 | xargs kill -9 2>/dev/null; sleep 2; cd "${WHATSAPP_SERVICE_PATH}" && npm start &`,
      (error, stdout, stderr) => {
        if (error) logger.error('WhatsApp restart error', { error: error.message, stack: error.stack });
      }
    );

    res.json({ 
      success: true, 
      message: 'WhatsApp servisi yeniden başlatılıyor...' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backend'i yeniden başlat (dikkatli kullan!)
router.post('/services/restart/backend', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Backend yeniden başlatılacak...' 
    });

    // Response gönderdikten sonra restart et
    setTimeout(() => {
      const backendPath = path.join(PROJECT_ROOT, 'backend');
      exec(`cd "${backendPath}" && pm2 restart all 2>/dev/null || (lsof -ti:3001 | xargs kill -9; npm start &)`);
    }, 1000);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sistem bilgisi
router.get('/info', async (req, res) => {
  try {
    const info = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development'
    };

    res.json({ success: true, info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
