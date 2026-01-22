import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

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
    const scriptPath = '/Users/numanaydar/Desktop/CATERİNG/start-all.sh';
    
    // Script'i background'da çalıştır
    exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Start script error:', error);
      }
      console.log('Start script output:', stdout);
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
    exec(`lsof -ti:3002 | xargs kill -9 2>/dev/null; sleep 2; cd /Users/numanaydar/Desktop/CATERİNG/services/whatsapp && npm start &`, 
      (error, stdout, stderr) => {
        if (error) console.error('WhatsApp restart error:', error);
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
      exec(`cd /Users/numanaydar/Desktop/CATERİNG/backend && pm2 restart all 2>/dev/null || (lsof -ti:3001 | xargs kill -9; npm start &)`);
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
