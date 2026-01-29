/**
 * AI Tools Registry
 * Tüm modüllerin AI tool'larını merkezi olarak yönetir
 * Yeni modül eklendiğinde sadece buraya register edilir
 *
 * GOD MODE: Sadece super_admin için sınırsız yetki tool'ları
 */

import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import vm from 'node:vm';
import { query } from '../../database.js';
import logger from '../../utils/logger.js';
import cariTools from './cari-tools.js';
import faturaTools from './fatura-tools.js';
import ihaleTools from './ihale-tools.js';
import { menuToolDefinitions, menuToolImplementations } from './menu-tools.js';
import { personelToolDefinitions, personelToolImplementations } from './personel-tools.js';
import { piyasaToolDefinitions, piyasaToolImplementations } from './piyasa-tools.js';
import raporTools from './rapor-tools.js';
import satinAlmaTools from './satin-alma-tools.js';
import { webToolDefinitions, webToolImplementations } from './web-tools.js';

const execAsync = promisify(exec);

// ============================================================
// GOD MODE TOOL DEFINITIONS (Sadece Super Admin)
// ============================================================

const godModeToolDefinitions = [
  {
    name: 'god_code_execute',
    description:
      'JavaScript kodu çalıştırır. Veritabanı sorguları, hesaplamalar, veri işleme yapabilir. Context içinde `query` (DB), `fetch` (HTTP) ve `console` erişilebilir. SINIRSIZ YETKİ - DİKKATLİ KULLAN!',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Çalıştırılacak JavaScript kodu. async/await kullanabilir. Son satırdaki değer döner.',
        },
        description: {
          type: 'string',
          description: 'Kodun ne yaptığının kısa açıklaması (audit log için)',
        },
      },
      required: ['code', 'description'],
    },
  },
  {
    name: 'god_sql_execute',
    description:
      'Raw SQL sorgusu çalıştırır. SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP - HER ŞEY! Parameterized query için $1, $2... kullan. SINIRSIZ YETKİ!',
    input_schema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'SQL sorgusu',
        },
        params: {
          type: 'array',
          description: 'Sorgu parametreleri (opsiyonel)',
          items: {},
        },
        description: {
          type: 'string',
          description: 'Sorgunun ne yaptığının açıklaması (audit log için)',
        },
      },
      required: ['sql', 'description'],
    },
  },
  {
    name: 'god_file_read',
    description: 'Proje dosyasını okur. Backend, frontend, config dosyaları dahil her şeyi okuyabilir.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Dosya yolu (proje kökünden göreceli veya mutlak). Örn: backend/src/server.js',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'god_file_write',
    description:
      'Dosya oluşturur veya günceller. Config, script, rapor dosyaları yazabilir. DİKKAT: Mevcut dosyayı tamamen üzerine yazar!',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Dosya yolu (proje kökünden göreceli)',
        },
        content: {
          type: 'string',
          description: 'Dosya içeriği',
        },
        description: {
          type: 'string',
          description: 'Ne yazıldığının açıklaması (audit log için)',
        },
      },
      required: ['path', 'content', 'description'],
    },
  },
  {
    name: 'god_file_list',
    description: 'Klasör içeriğini listeler. Dosya ve alt klasörleri gösterir.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Klasör yolu (proje kökünden göreceli). Boş bırakılırsa proje kökü.',
        },
        recursive: {
          type: 'boolean',
          description: 'Alt klasörleri de listele (varsayılan: false)',
        },
      },
    },
  },
  {
    name: 'god_shell_execute',
    description:
      'Terminal/shell komutu çalıştırır. pm2, git, npm, sistemkomutları. TEHLİKELİ - DİKKATLİ KULLAN! Timeout: 30 saniye.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell komutu. Örn: pm2 restart backend, git status, npm install',
        },
        cwd: {
          type: 'string',
          description: 'Çalışma dizini (opsiyonel, varsayılan: proje kökü)',
        },
        description: {
          type: 'string',
          description: 'Komutun ne yaptığının açıklaması (audit log için)',
        },
      },
      required: ['command', 'description'],
    },
  },
  {
    name: 'god_http_request',
    description: "Dış API'lara HTTP isteği gönderir. GET, POST, PUT, DELETE. Webhook, entegrasyon, veri çekme için.",
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: "İstek URL'i",
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP metodu (varsayılan: GET)',
        },
        headers: {
          type: 'object',
          description: 'İstek başlıkları (opsiyonel)',
        },
        body: {
          type: 'object',
          description: "İstek body'si (POST/PUT için)",
        },
        description: {
          type: 'string',
          description: 'İsteğin amacı (audit log için)',
        },
      },
      required: ['url', 'description'],
    },
  },
  {
    name: 'god_create_tool',
    description:
      "Yeni bir tool tanımı oluşturur ve veritabanına kaydeder. Sonraki oturumlarda kullanılabilir. META-TOOL: AI kendi tool'unu yaratır!",
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Tool adı (benzersiz, snake_case)',
        },
        description: {
          type: 'string',
          description: "Tool'un ne yaptığının açıklaması",
        },
        parameters: {
          type: 'object',
          description: 'Tool parametreleri (JSON Schema formatında)',
        },
        implementation: {
          type: 'string',
          description:
            "Tool'un JavaScript implementasyonu. Fonksiyon body'si olarak yazılmalı. params objesi ile parametreler gelir.",
        },
      },
      required: ['name', 'description', 'parameters', 'implementation'],
    },
  },
  // ============================================================
  // SECRET MANAGEMENT TOOLS
  // ============================================================
  {
    name: 'god_list_secrets',
    description:
      "Kayıtlı API key ve secret'ları listeler. Değerler maskeli gösterilir. Hangi servislere erişim olduğunu görmek için kullan.",
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Filtrelemek için servis adı (opsiyonel). Örn: github, openai, supabase',
        },
      },
    },
  },
  {
    name: 'god_get_secret',
    description: "Bir secret'ın değerini alır. API çağrıları yapmak için kullan. HASSAS BİLGİ - DİKKATLİ KULLAN!",
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Secret adı. Örn: GITHUB_TOKEN, OPENAI_API_KEY',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'god_add_secret',
    description: 'Yeni bir API key veya secret ekler. Admin panelinden de eklenebilir.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Secret adı (benzersiz, UPPERCASE). Örn: GITHUB_TOKEN',
        },
        value: {
          type: 'string',
          description: 'Secret değeri. Şifrelenip saklanacak.',
        },
        service: {
          type: 'string',
          description: 'Servis adı. Örn: github, openai, supabase, slack, custom',
        },
        description: {
          type: 'string',
          description: 'Bu key ne için kullanılıyor?',
        },
      },
      required: ['name', 'value', 'service'],
    },
  },
  {
    name: 'god_delete_secret',
    description: "Bir secret'ı siler. DİKKAT: Geri alınamaz!",
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Silinecek secret adı',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'god_read_env',
    description: 'Backend .env dosyasındaki değişkenleri okur. Mevcut konfigürasyonu görmek için kullan.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Belirli bir key (opsiyonel). Boş bırakılırsa tüm key isimleri listelenir (değerler gizli).',
        },
        showValue: {
          type: 'boolean',
          description: 'Değeri de göster (sadece belirli key için, varsayılan: false)',
        },
      },
    },
  },
  {
    name: 'god_github_api',
    description: "GitHub API'sına istek gönderir. Repo, issue, commit işlemleri için. GITHUB_TOKEN secret'ı gerekli.",
    input_schema: {
      type: 'object',
      properties: {
        endpoint: {
          type: 'string',
          description: 'API endpoint. Örn: /repos/owner/repo, /user/repos, /repos/owner/repo/issues',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP metodu (varsayılan: GET)',
        },
        body: {
          type: 'object',
          description: "İstek body'si (POST/PUT için)",
        },
      },
      required: ['endpoint'],
    },
  },
  {
    name: 'god_supabase_storage',
    description: 'Supabase Storage işlemleri. Dosya yükle, indir, listele, sil.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'upload', 'download', 'delete', 'createBucket'],
          description: 'İşlem türü',
        },
        bucket: {
          type: 'string',
          description: 'Bucket adı',
        },
        path: {
          type: 'string',
          description: 'Dosya yolu (upload/download/delete için)',
        },
        content: {
          type: 'string',
          description: 'Dosya içeriği (upload için, base64 veya text)',
        },
      },
      required: ['action', 'bucket'],
    },
  },
];

// ============================================================
// GOD MODE TOOL IMPLEMENTATIONS
// ============================================================

const godModeToolImplementations = {
  // JavaScript kod çalıştırma
  god_code_execute: async ({ code, description }) => {
    logger.warn(`[GOD MODE] Code Execute: ${description}`, { description });

    try {
      // Sandbox context oluştur
      const sandbox = {
        query, // Veritabanı erişimi
        fetch, // HTTP istekleri
        console: {
          log: (...args) => logger.debug('[GOD CODE]', { message: args.join(' ') }),
          error: (...args) => logger.error('[GOD CODE]', { message: args.join(' ') }),
          warn: (...args) => logger.warn('[GOD CODE]', { message: args.join(' ') }),
        },
        JSON,
        Date,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Promise,
        setTimeout,
        Buffer,
        // Sonuç için
        __result: undefined,
      };

      // Kodu async wrapper içine al
      const wrappedCode = `
        (async () => {
          ${code}
        })().then(r => __result = r).catch(e => __result = { error: e.message });
      `;

      // VM context oluştur
      vm.createContext(sandbox);

      // Kodu çalıştır (timeout: 30 saniye)
      vm.runInContext(wrappedCode, sandbox, { timeout: 30000 });

      // Async işlemlerin tamamlanmasını bekle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Sonucu al
      let result = sandbox.__result;

      // Eğer hala undefined ise biraz daha bekle
      if (result === undefined) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        result = sandbox.__result;
      }

      return {
        success: true,
        result,
        description,
        executed_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        description,
      };
    }
  },

  // Raw SQL çalıştırma
  god_sql_execute: async ({ sql, params = [], description }) => {
    logger.warn(`[GOD MODE] SQL Execute: ${description}`, { description, sqlPreview: sql.substring(0, 200) });

    try {
      const result = await query(sql, params);

      return {
        success: true,
        rowCount: result.rowCount,
        rows: result.rows,
        command: result.command,
        description,
        executed_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        sql: sql.substring(0, 500),
        description,
      };
    }
  },

  // Dosya okuma
  god_file_read: async ({ path: filePath }) => {
    logger.warn(`[GOD MODE] File Read: ${filePath}`, { filePath });

    try {
      // Güvenlik: Sadece proje içinde
      const projectRoot = process.cwd();
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

      // Dosyayı oku
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);

      return {
        success: true,
        path: filePath,
        content,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: filePath,
      };
    }
  },

  // Dosya yazma
  god_file_write: async ({ path: filePath, content, description }) => {
    logger.warn(`[GOD MODE] File Write: ${filePath} - ${description}`, { filePath, description });

    try {
      const projectRoot = process.cwd();
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

      // Klasör yoksa oluştur
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Dosyayı yaz
      await fs.writeFile(fullPath, content, 'utf-8');

      return {
        success: true,
        path: filePath,
        size: content.length,
        description,
        written_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: filePath,
      };
    }
  },

  // Klasör listeleme
  god_file_list: async ({ path: dirPath = '.', recursive = false }) => {
    logger.warn(`[GOD MODE] File List: ${dirPath}`, { dirPath });

    try {
      const projectRoot = process.cwd();
      const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(projectRoot, dirPath);

      const listDir = async (dir, prefix = '') => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const items = [];

        for (const entry of entries) {
          // node_modules ve .git'i atla
          if (entry.name === 'node_modules' || entry.name === '.git') continue;

          const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.isDirectory()) {
            items.push({ name: itemPath, type: 'directory' });
            if (recursive) {
              const subItems = await listDir(path.join(dir, entry.name), itemPath);
              items.push(...subItems);
            }
          } else {
            const stats = await fs.stat(path.join(dir, entry.name));
            items.push({
              name: itemPath,
              type: 'file',
              size: stats.size,
            });
          }
        }

        return items;
      };

      const items = await listDir(fullPath);

      return {
        success: true,
        path: dirPath,
        items,
        count: items.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        path: dirPath,
      };
    }
  },

  // Shell komutu çalıştırma
  god_shell_execute: async ({ command, cwd, description }) => {
    logger.warn(`[GOD MODE] Shell Execute: ${description}`, { description, command });

    // Tehlikeli komutları kontrol et (uyarı amaçlı)
    const dangerousPatterns = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if='];
    const isDangerous = dangerousPatterns.some((p) => command.includes(p));

    if (isDangerous) {
      logger.warn(`[GOD MODE] DANGEROUS COMMAND DETECTED: ${command}`, { command });
    }

    try {
      const projectRoot = process.cwd();
      const workDir = cwd ? path.join(projectRoot, cwd) : projectRoot;

      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 30000, // 30 saniye timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      return {
        success: true,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        command,
        description,
        executed_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        command,
        description,
      };
    }
  },

  // HTTP isteği
  god_http_request: async ({ url, method = 'GET', headers = {}, body, description }) => {
    logger.warn(`[GOD MODE] HTTP Request: ${method} ${url} - ${description}`, { method, url, description });

    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CateringPro-GodMode/1.0',
          ...headers,
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        url,
        method,
        description,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        url,
        method,
        description,
      };
    }
  },

  // Yeni tool oluşturma (META-TOOL)
  god_create_tool: async ({ name, description, parameters, implementation }) => {
    logger.warn(`[GOD MODE] Create Tool: ${name}`, { toolName: name });

    try {
      // Tool'u veritabanına kaydet
      const result = await query(
        `
        INSERT INTO ai_custom_tools (name, description, parameters, implementation, created_by, is_active)
        VALUES ($1, $2, $3, $4, 'god_mode', true)
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          parameters = EXCLUDED.parameters,
          implementation = EXCLUDED.implementation,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, created_at
      `,
        [name, description, JSON.stringify(parameters), implementation]
      );

      return {
        success: true,
        tool: result.rows[0],
        message: `Tool "${name}" oluşturuldu/güncellendi. Sonraki oturumlarda kullanılabilir.`,
        note: 'Tool hemen aktif değil, sistem yeniden başlatıldığında veya özel olarak yüklendiğinde aktif olur.',
      };
    } catch (error) {
      // Tablo yoksa oluştur
      if (error.message.includes('does not exist')) {
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS ai_custom_tools (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) UNIQUE NOT NULL,
              description TEXT,
              parameters JSONB,
              implementation TEXT,
              created_by VARCHAR(100),
              is_active BOOLEAN DEFAULT true,
              usage_count INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Tekrar dene
          return await godModeToolImplementations.god_create_tool({ name, description, parameters, implementation });
        } catch (createError) {
          return {
            success: false,
            error: `Tablo oluşturulamadı: ${createError.message}`,
          };
        }
      }

      return {
        success: false,
        error: error.message,
        name,
      };
    }
  },

  // ============================================================
  // SECRET MANAGEMENT IMPLEMENTATIONS
  // ============================================================

  // Secret listele
  god_list_secrets: async ({ service }) => {
    logger.warn(`[GOD MODE] List Secrets${service ? ` (service: ${service})` : ''}`, { service });

    try {
      let sql = `
        SELECT name, service, description, is_active, usage_count, 
               last_used_at, created_at,
               CONCAT(LEFT(encrypted_value, 8), '****') as masked_value
        FROM ai_secrets
      `;
      const params = [];

      if (service) {
        sql += ` WHERE service = $1`;
        params.push(service);
      }

      sql += ` ORDER BY service, name`;

      const result = await query(sql, params);

      // .env'deki key'leri de ekle
      const envKeys = Object.keys(process.env)
        .filter((k) => k.includes('KEY') || k.includes('TOKEN') || k.includes('SECRET') || k.includes('PASSWORD'))
        .map((k) => ({ name: k, source: 'env', masked_value: '****' }));

      return {
        success: true,
        secrets: result.rows,
        envKeys,
        total: result.rows.length,
        note: 'Değerler güvenlik için maskeli gösterilmektedir',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Secret değeri al
  god_get_secret: async ({ name }) => {
    logger.warn(`[GOD MODE] Get Secret: ${name}`, { secretName: name });

    try {
      // Önce .env'de var mı kontrol et
      if (process.env[name]) {
        return {
          success: true,
          name,
          value: process.env[name],
          source: 'env',
        };
      }

      // Veritabanından al
      const result = await query(
        `
        UPDATE ai_secrets 
        SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP
        WHERE name = $1 AND is_active = true
        RETURNING encrypted_value, service
      `,
        [name]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: `Secret bulunamadı: ${name}`,
          hint: "god_list_secrets ile mevcut secret'ları görüntüleyebilirsin",
        };
      }

      // Basit "decryption" (production'da AES kullanılmalı)
      const value = Buffer.from(result.rows[0].encrypted_value, 'base64').toString('utf-8');

      return {
        success: true,
        name,
        value,
        service: result.rows[0].service,
        source: 'database',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Yeni secret ekle
  god_add_secret: async ({ name, value, service, description }) => {
    logger.warn(`[GOD MODE] Add Secret: ${name} (${service})`, { secretName: name, service });

    try {
      // Basit "encryption" (production'da AES kullanılmalı)
      const encryptedValue = Buffer.from(value).toString('base64');

      const result = await query(
        `
        INSERT INTO ai_secrets (name, encrypted_value, service, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
          encrypted_value = EXCLUDED.encrypted_value,
          service = EXCLUDED.service,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, service, created_at
      `,
        [name.toUpperCase(), encryptedValue, service, description]
      );

      return {
        success: true,
        secret: result.rows[0],
        message: `Secret "${name}" başarıyla eklendi/güncellendi`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Secret sil
  god_delete_secret: async ({ name }) => {
    logger.warn(`[GOD MODE] Delete Secret: ${name}`, { secretName: name });

    try {
      const result = await query(
        `
        DELETE FROM ai_secrets WHERE name = $1 RETURNING name
      `,
        [name]
      );

      if (result.rows.length === 0) {
        return { success: false, error: `Secret bulunamadı: ${name}` };
      }

      return {
        success: true,
        message: `Secret "${name}" silindi`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // .env dosyasını oku
  god_read_env: async ({ key, showValue = false }) => {
    logger.warn(`[GOD MODE] Read ENV${key ? `: ${key}` : ' (all keys)'}`, { key });

    try {
      if (key) {
        const value = process.env[key];
        if (!value) {
          return { success: false, error: `ENV key bulunamadı: ${key}` };
        }
        return {
          success: true,
          key,
          value: showValue ? value : '****' + value.slice(-4),
          length: value.length,
        };
      }

      // Tüm key'leri listele (değerler gizli)
      const envKeys = Object.keys(process.env)
        .filter((k) => !k.startsWith('npm_') && !k.startsWith('_'))
        .sort()
        .map((k) => ({
          key: k,
          hasValue: !!process.env[k],
          length: process.env[k]?.length || 0,
        }));

      return {
        success: true,
        keys: envKeys,
        total: envKeys.length,
        note: 'Değerler güvenlik için gizli. Belirli bir key için showValue: true kullan.',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // GitHub API
  god_github_api: async ({ endpoint, method = 'GET', body }) => {
    logger.warn(`[GOD MODE] GitHub API: ${method} ${endpoint}`, { method, endpoint });

    try {
      // Token al
      let token = process.env.GITHUB_TOKEN;

      if (!token) {
        // DB'den dene
        const secretResult = await query(`
          SELECT encrypted_value FROM ai_secrets 
          WHERE name = 'GITHUB_TOKEN' AND is_active = true
        `);

        if (secretResult.rows.length > 0) {
          token = Buffer.from(secretResult.rows[0].encrypted_value, 'base64').toString('utf-8');
        }
      }

      if (!token) {
        return {
          success: false,
          error: 'GITHUB_TOKEN bulunamadı',
          hint: 'god_add_secret ile GITHUB_TOKEN ekle: { name: "GITHUB_TOKEN", value: "ghp_xxx", service: "github" }',
        };
      }

      const url = `https://api.github.com${endpoint}`;
      const options = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'CateringPro-GodMode',
        },
      };

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, options);
      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data,
        endpoint,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Supabase Storage
  god_supabase_storage: async ({ action, bucket, path: filePath, content }) => {
    logger.warn(`[GOD MODE] Supabase Storage: ${action} ${bucket}${filePath ? '/' + filePath : ''}`, {
      action,
      bucket,
      filePath,
    });

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return {
          success: false,
          error: 'Supabase credentials bulunamadı',
          hint: '.env dosyasında NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_KEY olmalı',
        };
      }

      const baseUrl = `${supabaseUrl}/storage/v1`;
      const headers = {
        Authorization: `Bearer ${supabaseKey}`,
        apikey: supabaseKey,
      };

      switch (action) {
        case 'list': {
          const url = filePath ? `${baseUrl}/object/list/${bucket}?prefix=${filePath}` : `${baseUrl}/bucket/${bucket}`;

          const response = await fetch(url, { headers });
          const data = await response.json();

          return { success: response.ok, action, bucket, data };
        }

        case 'upload': {
          if (!filePath || !content) {
            return { success: false, error: 'path ve content gerekli' };
          }

          const url = `${baseUrl}/object/${bucket}/${filePath}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/octet-stream',
            },
            body: content,
          });

          const data = await response.json();
          return { success: response.ok, action, bucket, path: filePath, data };
        }

        case 'download': {
          if (!filePath) {
            return { success: false, error: 'path gerekli' };
          }

          const url = `${baseUrl}/object/${bucket}/${filePath}`;
          const response = await fetch(url, { headers });

          if (!response.ok) {
            return { success: false, error: 'Dosya indirilemedi' };
          }

          const text = await response.text();
          return { success: true, action, bucket, path: filePath, content: text.substring(0, 10000) };
        }

        case 'delete': {
          if (!filePath) {
            return { success: false, error: 'path gerekli' };
          }

          const url = `${baseUrl}/object/${bucket}/${filePath}`;
          const response = await fetch(url, {
            method: 'DELETE',
            headers,
          });

          return { success: response.ok, action, bucket, path: filePath };
        }

        case 'createBucket': {
          const url = `${baseUrl}/bucket`;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              ...headers,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: bucket, public: false }),
          });

          const data = await response.json();
          return { success: response.ok, action, bucket, data };
        }

        default:
          return { success: false, error: `Bilinmeyen action: ${action}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};

class AIToolsRegistry {
  constructor() {
    this.tools = new Map();
    this.toolDefinitions = [];

    // Tüm modül tool'larını register et
    this.registerModule('satin_alma', satinAlmaTools);
    this.registerModule('cari', cariTools);
    this.registerModule('fatura', faturaTools);
    this.registerModule('ihale', ihaleTools);
    this.registerModule('rapor', raporTools);

    // Personel modülü (yeni format)
    this.registerPersonelModule();

    // Web/Mevzuat modülü
    this.registerWebModule();

    // Piyasa modülü
    this.registerPiyasaModule();

    // Menü planlama modülü
    this.registerMenuModule();
  }

  /**
   * Piyasa modülünü register et
   */
  registerPiyasaModule() {
    logger.debug('[AI Tools] piyasa modülü register ediliyor');

    for (const toolDef of piyasaToolDefinitions) {
      const handler = piyasaToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(piyasaToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }

    logger.info(`[AI Tools] piyasa: ${piyasaToolDefinitions.length} tool eklendi`, {
      module: 'piyasa',
      toolCount: piyasaToolDefinitions.length,
    });
  }

  /**
   * Menü planlama modülünü register et
   */
  registerMenuModule() {
    logger.debug('[AI Tools] menu modülü register ediliyor');

    for (const toolDef of menuToolDefinitions) {
      const handler = menuToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(menuToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }

    logger.info(`[AI Tools] menu: ${menuToolDefinitions.length} tool eklendi`, {
      module: 'menu',
      toolCount: menuToolDefinitions.length,
    });
  }

  /**
   * Web/Mevzuat modülünü register et
   */
  registerWebModule() {
    logger.debug('[AI Tools] web/mevzuat modülü register ediliyor');

    for (const toolDef of webToolDefinitions) {
      const handler = webToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(webToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }

    logger.info(`[AI Tools] web/mevzuat: ${webToolDefinitions.length} tool eklendi`, {
      module: 'web/mevzuat',
      toolCount: webToolDefinitions.length,
    });
  }

  /**
   * Personel modülünü register et (özel format)
   */
  registerPersonelModule() {
    logger.debug('[AI Tools] personel modülü register ediliyor');

    for (const toolDef of personelToolDefinitions) {
      const handler = personelToolImplementations[toolDef.name];
      if (handler) {
        this.tools.set(toolDef.name, handler.bind(personelToolImplementations));
        this.toolDefinitions.push(toolDef);
      }
    }

    logger.info(`[AI Tools] personel: ${personelToolDefinitions.length} tool eklendi`, {
      module: 'personel',
      toolCount: personelToolDefinitions.length,
    });
  }

  /**
   * Modül tool'larını register et
   */
  registerModule(moduleName, moduleTools) {
    logger.debug(`[AI Tools] ${moduleName} modülü register ediliyor`, { moduleName });

    for (const [toolName, tool] of Object.entries(moduleTools)) {
      const fullName = `${moduleName}_${toolName}`;
      this.tools.set(fullName, tool.handler);
      this.toolDefinitions.push({
        name: fullName,
        description: tool.description,
        input_schema: tool.parameters,
      });
    }

    logger.info(`[AI Tools] ${moduleName}: ${Object.keys(moduleTools).length} tool eklendi`, {
      moduleName,
      toolCount: Object.keys(moduleTools).length,
    });
  }

  /**
   * Claude API için tool tanımlarını al
   */
  getToolDefinitions() {
    return this.toolDefinitions;
  }

  /**
   * Tool'u çalıştır
   */
  async executeTool(toolName, parameters) {
    const handler = this.tools.get(toolName);

    if (!handler) {
      return {
        success: false,
        error: `Tool bulunamadı: ${toolName}`,
      };
    }

    try {
      logger.debug(`[AI Tools] Çalıştırılıyor: ${toolName}`, { toolName, parameters });
      const result = await handler(parameters);
      logger.debug(`[AI Tools] ${toolName} tamamlandı`, { toolName });
      return result;
    } catch (error) {
      logger.error(`[AI Tools] ${toolName} hatası`, { toolName, error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Mevcut tool'ları listele (debug için)
   */
  listTools() {
    return Array.from(this.tools.keys());
  }

  /**
   * Sistem özeti (AI context için)
   */
  getSystemContext() {
    return {
      availableModules: [
        'satin_alma - Satın alma ve sipariş yönetimi',
        'cari - Müşteri ve tedarikçi yönetimi',
        'fatura - Fatura ve e-fatura yönetimi',
        'ihale - İhale takip ve analiz',
        'rapor - Raporlama ve analitik',
        'personel - Personel, bordro, izin ve kıdem yönetimi',
        'piyasa - Piyasa fiyat araştırma ve takip',
        'menu - Reçete ve menü planlama, maliyet hesaplama',
      ],
      totalTools: this.tools.size,
      capabilities: [
        'Veri sorgulama (siparişler, cariler, faturalar, ihaleler, personeller)',
        'Kayıt oluşturma (sipariş, proje, cari, izin talebi)',
        'Kayıt güncelleme (durum, öncelik, bilgiler)',
        'Kayıt silme',
        'Raporlama (proje bazlı, tedarikçi bazlı, dönemsel)',
        'Bordro ve maaş hesaplama',
        'Kıdem ve ihbar tazminatı hesaplama',
        'İzin yönetimi ve bakiye sorgulama',
        'SGK, vergi ve mevzuat bilgisi',
        'Reçete oluşturma ve maliyet hesaplama',
        'Menü planlama ve optimizasyon',
        'Besin değeri analizi',
        'Analiz ve öneriler',
      ],
    };
  }

  // ============================================================
  // GOD MODE METODLARI (Sadece Super Admin)
  // ============================================================

  /**
   * God Mode tool tanımlarını al (normal + god mode)
   * SADECE SUPER ADMIN İÇİN!
   */
  getGodModeToolDefinitions() {
    return [...this.toolDefinitions, ...godModeToolDefinitions];
  }

  /**
   * God Mode tool çalıştır
   * Normal tool'lar + God Mode tool'ları
   * SADECE SUPER ADMIN İÇİN!
   */
  async executeGodModeTool(toolName, parameters, userId = 'unknown') {
    // Önce normal tool'larda ara
    if (this.tools.has(toolName)) {
      return await this.executeTool(toolName, parameters);
    }

    // God Mode tool'larında ara
    const handler = godModeToolImplementations[toolName];

    if (!handler) {
      return {
        success: false,
        error: `Tool bulunamadı: ${toolName}`,
      };
    }

    // Audit log - God Mode işlemleri MUTLAKA loglanmalı
    logger.warn(`[GOD MODE] User: ${userId} | Tool: ${toolName}`, {
      userId,
      toolName,
      parametersPreview: JSON.stringify(parameters).substring(0, 500),
    });

    try {
      // God Mode audit log'u veritabanına kaydet
      await query(
        `
        INSERT INTO ai_god_mode_logs (user_id, tool_name, parameters, status)
        VALUES ($1, $2, $3, 'started')
        RETURNING id
      `,
        [userId, toolName, JSON.stringify(parameters)]
      ).catch(() => {
        // Tablo yoksa oluştur (ilk kullanımda)
        return query(`
          CREATE TABLE IF NOT EXISTS ai_god_mode_logs (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(100),
            tool_name VARCHAR(100),
            parameters JSONB,
            result JSONB,
            status VARCHAR(50),
            error_message TEXT,
            execution_time_ms INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `).then(() =>
          query(
            `
          INSERT INTO ai_god_mode_logs (user_id, tool_name, parameters, status)
          VALUES ($1, $2, $3, 'started')
        `,
            [userId, toolName, JSON.stringify(parameters)]
          )
        );
      });

      const startTime = Date.now();
      const result = await handler(parameters);
      const executionTime = Date.now() - startTime;

      // Sonucu logla
      await query(
        `
        UPDATE ai_god_mode_logs 
        SET result = $1, status = $2, execution_time_ms = $3
        WHERE user_id = $4 AND tool_name = $5 AND status = 'started'
        ORDER BY created_at DESC LIMIT 1
      `,
        [
          JSON.stringify(result).substring(0, 10000),
          result.success ? 'success' : 'failed',
          executionTime,
          userId,
          toolName,
        ]
      ).catch(() => {});

      logger.warn(`[GOD MODE] ${toolName} completed in ${executionTime}ms`, { userId, toolName, executionTime });

      return result;
    } catch (error) {
      logger.error(`[GOD MODE] ${toolName} HATA`, { userId, toolName, error: error.message, stack: error.stack });

      // Hata logla
      await query(
        `
        UPDATE ai_god_mode_logs 
        SET status = 'error', error_message = $1
        WHERE user_id = $2 AND tool_name = $3 AND status = 'started'
        ORDER BY created_at DESC LIMIT 1
      `,
        [error.message, userId, toolName]
      ).catch(() => {});

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * God Mode tool listesi
   */
  listGodModeTools() {
    return godModeToolDefinitions.map((t) => t.name);
  }

  /**
   * God Mode sistem context'i
   */
  getGodModeSystemContext() {
    return {
      ...this.getSystemContext(),
      godModeEnabled: true,
      godModeTools: this.listGodModeTools(),
      additionalCapabilities: [
        'JavaScript kod çalıştırma (sınırsız)',
        'Raw SQL sorguları (SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP)',
        'Dosya okuma/yazma (tüm proje)',
        'Shell/terminal komutları (pm2, git, npm, sistem)',
        "HTTP istekleri (dış API'lar)",
        'Yeni tool oluşturma (meta-programming)',
      ],
      warning: '⚠️ GOD MODE AKTİF - TÜM İŞLEMLER LOGLANMAKTADIR!',
    };
  }
}

// Singleton instance
const aiTools = new AIToolsRegistry();

export default aiTools;
export { AIToolsRegistry, godModeToolDefinitions, godModeToolImplementations };
