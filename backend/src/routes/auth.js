/**
 * AUTH ROUTES - PostgreSQL Only (Simplified)
 * Supabase Auth KALDIRILDI - Sadece bcrypt + JWT
 *
 * Token süreleri:
 * - Access Token: 24 saat (eskiden 15 dakika)
 * - Refresh Token: 30 gün
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import loginAttemptService from '../services/login-attempt-service.js';
import sessionService from '../services/session-service.js';
import logger, { logAuth } from '../utils/logger.js';
import {
  changePasswordSchema,
  createIpRuleSchema,
  lockAccountSchema,
  loginAttemptsQuerySchema,
  loginSchema,
  registerSchema,
  updateIpRuleSchema,
  updateProfileSchema,
  updateUserSchema,
  validatePasswordSchema,
} from '../validations/auth.js';

const router = express.Router();

// JWT_SECRET kontrolü
if (!process.env.JWT_SECRET) {
  logger.error('KRITIK: JWT_SECRET tanımlanmamış!');
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Token süreleri - GÜNCELLENDİ
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 saat (eskiden 15 dakika)
const _REFRESH_TOKEN_EXPIRY = '30d'; // 30 gün
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 saat (ms)
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 gün (ms)

// Şifre güçlülük kontrolü
const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('En az 8 karakter gerekli');
  if (!/[A-Z]/.test(password)) errors.push('En az bir büyük harf gerekli');
  if (!/[a-z]/.test(password)) errors.push('En az bir küçük harf gerekli');
  if (!/[0-9]/.test(password)) errors.push('En az bir rakam gerekli');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) errors.push('En az bir özel karakter gerekli');
  return { valid: errors.length === 0, errors };
};

// Cookie ayarları
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge,
  path: '/',
});

// Refresh token hash'leme
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * LOGIN - Sadece PostgreSQL + bcrypt
 * Supabase Auth KALDIRILDI
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Kilit durumunu kontrol et
    const lockStatus = await loginAttemptService.checkLockStatusByEmail(email);
    if (lockStatus.isLocked) {
      const minutesRemaining = Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Hesabınız kilitlendi. ${minutesRemaining} dakika sonra tekrar deneyin.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: lockStatus.lockedUntil.toISOString(),
        minutesRemaining,
      });
    }

    // Kullanıcıyı bul
    const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);

    if (result.rows.length === 0) {
      await loginAttemptService.recordFailedLogin(email, ipAddress, userAgent);
      logAuth('Login failed - user not found', null, { email, ip: ipAddress });
      return res.status(401).json({ success: false, error: 'Geçersiz email veya şifre' });
    }

    const user = result.rows[0];

    // password_hash kontrolü
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'Bu kullanıcı için şifre tanımlanmamış. Lütfen yöneticinizle iletişime geçin.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    // Şifre doğrulama
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      const attemptResult = await loginAttemptService.recordFailedLogin(email, ipAddress, userAgent);
      logAuth('Login failed - wrong password', user.id, { email, ip: ipAddress });

      if (attemptResult.isLocked) {
        const minutesRemaining = attemptResult.lockedUntil
          ? Math.ceil((attemptResult.lockedUntil.getTime() - Date.now()) / 60000)
          : 0;

        return res.status(423).json({
          success: false,
          error: `Çok fazla başarısız deneme. Hesabınız ${minutesRemaining} dakika kilitlendi.`,
          code: 'ACCOUNT_LOCKED',
          minutesRemaining,
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Geçersiz email veya şifre',
        remainingAttempts: attemptResult.remainingAttempts,
      });
    }

    // Başarılı login
    await loginAttemptService.recordSuccessfulLogin(user.id, ipAddress, userAgent);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // JWT Access Token oluştur (24 saat)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        user_type: user.user_type || 'user',
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh Token oluştur
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);

    // Refresh token'ı DB'ye kaydet
    try {
      await query(
        `
        INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
      `,
        [user.id, refreshTokenHash, JSON.stringify({ userAgent }), ipAddress]
      );

      // Session oluştur
      try {
        const deviceInfo = sessionService.parseDeviceInfo(userAgent);
        await sessionService.createSession(user.id, refreshTokenHash, ipAddress, userAgent, deviceInfo);
      } catch (sessionError) {
        logger.warn('Session kaydedilemedi', { error: sessionError.message });
      }
    } catch (dbError) {
      logger.warn('Refresh token kaydedilemedi', { error: dbError.message });
    }

    // Cookie'lere kaydet
    res.cookie('access_token', accessToken, getCookieOptions(COOKIE_MAX_AGE));
    res.cookie('refresh_token', refreshToken, getCookieOptions(REFRESH_COOKIE_MAX_AGE));

    res.json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        user_type: user.user_type || 'user',
      },
    });
  } catch (error) {
    logger.error('Login hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * REGISTER - Yeni kullanıcı kaydı
 */
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, name, role, user_type } = req.body;

    // Email kontrolü
    const existing = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu email zaten kullanılıyor' });
    }

    // Şifre hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const finalUserType = user_type || (role === 'admin' ? 'admin' : 'user');

    // Kullanıcı oluştur
    const result = await query(
      `
      INSERT INTO users (email, password_hash, name, role, user_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, user_type
    `,
      [email, passwordHash, name, role, finalUserType]
    );

    logAuth('User registered', result.rows[0].id, { email, role, userType: finalUserType });

    res.json({
      success: true,
      message: 'Kullanıcı oluşturuldu',
      user: result.rows[0],
    });
  } catch (error) {
    logger.error('Register hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ME - Mevcut kullanıcı bilgisi
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        user_type: req.user.user_type || 'user',
      },
    });
  } catch (error) {
    logger.error('Auth hatası', { error: error.message });
    res.status(500).json({ success: false, error: 'Kullanıcı bilgisi alınamadı' });
  }
});

/**
 * PROFILE - Profil güncelleme
 */
router.put('/profile', authenticate, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name } = req.body;

    const result = await query(
      `
      UPDATE users SET name = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
      RETURNING id, email, name, role, created_at
    `,
      [name.trim(), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Profil güncellendi',
      user: result.rows[0],
    });
  } catch (error) {
    logger.error('Profil güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PASSWORD - Şifre değiştirme
 */
router.put('/password', authenticate, validate(changePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const userResult = await query('SELECT id, password_hash FROM users WHERE id = $1 AND is_active = true', [
      req.user.id,
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!validPassword) {
      return res.status(400).json({ success: false, error: 'Mevcut şifre yanlış' });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await query(
      `
      UPDATE users SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `,
      [newPasswordHash, req.user.id]
    );

    logAuth('Password changed', req.user.id);

    res.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi',
    });
  } catch (error) {
    logger.error('Şifre değiştirme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * LOGOUT - Çıkış yap
 */
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      try {
        await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
      } catch (dbError) {
        logger.debug('Refresh token revoke edilemedi', { error: dbError.message });
      }
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    // Kullanici bilgisini token'dan al (varsa)
    let logoutUserId = null;
    try {
      const accessToken = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
      if (accessToken) {
        const decoded = jwt.verify(accessToken, JWT_SECRET, { ignoreExpiration: true });
        logoutUserId = decoded.id;
      }
    } catch (_tokenErr) {
      // Token parse edilemezse userId olmadan logla
    }
    logAuth('User logged out', logoutUserId);

    res.json({ success: true, message: 'Çıkış yapıldı' });
  } catch (error) {
    logger.error('Logout hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * REFRESH - Token yenileme
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token bulunamadı' });
    }

    const tokenHash = hashToken(refreshToken);

    let tokenRecord;
    try {
      const result = await query(
        `
        SELECT rt.*, u.email, u.role, u.user_type
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
          AND rt.expires_at > NOW()
          AND rt.revoked_at IS NULL
          AND u.is_active = true
      `,
        [tokenHash]
      );
      tokenRecord = result.rows[0];
    } catch (dbError) {
      logger.warn('Refresh tokens tablosu mevcut değil', { error: dbError.message });
      return res.status(401).json({ success: false, error: 'Token yenileme henüz aktif değil' });
    }

    if (!tokenRecord) {
      res.clearCookie('refresh_token', { path: '/' });
      return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş refresh token' });
    }

    // Session activity güncelle
    try {
      await sessionService.updateSessionActivity(tokenHash);
    } catch (sessionError) {
      logger.debug('Session activity güncellenemedi', { error: sessionError.message });
    }

    // Yeni access token oluştur
    const newAccessToken = jwt.sign(
      {
        id: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role,
        user_type: tokenRecord.user_type || 'user',
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    res.cookie('access_token', newAccessToken, getCookieOptions(COOKIE_MAX_AGE));

    res.json({
      success: true,
      token: newAccessToken,
      message: 'Token yenilendi',
    });
  } catch (error) {
    logger.error('Token refresh hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * REVOKE-ALL - Tüm oturumları kapat
 */
router.post('/revoke-all', authenticate, async (req, res) => {
  try {
    try {
      await query(
        `
        UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
      `,
        [req.user.id]
      );
    } catch (dbError) {
      logger.warn('Refresh tokens tablosu mevcut değil', { error: dbError.message });
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    res.json({ success: true, message: 'Tüm oturumlar kapatıldı' });
  } catch (error) {
    logger.error('Revoke all hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * VALIDATE-PASSWORD - Şifre güçlülük kontrolü
 */
router.post('/validate-password', validate(validatePasswordSchema), (req, res) => {
  const { password } = req.body;

  const result = validatePassword(password);
  res.json({
    success: true,
    valid: result.valid,
    errors: result.errors,
    strength: result.errors.length === 0 ? 'strong' : result.errors.length <= 2 ? 'medium' : 'weak',
  });
});

// ========== ADMIN ENDPOINTS ==========

/**
 * GET /users - Tüm kullanıcıları listele (Admin)
 */
router.get('/users', authenticate, requireAdmin, async (_req, res) => {
  try {
    let result;
    try {
      result = await query(`
        SELECT id, email, name, role, user_type, is_active,
               failed_login_attempts, locked_until, lockout_count, last_failed_login,
               created_at, updated_at
        FROM users ORDER BY created_at DESC
      `);
    } catch (dbError) {
      if (dbError.message?.includes('does not exist')) {
        result = await query(`
          SELECT id, email, name, role, is_active, created_at, updated_at
          FROM users ORDER BY created_at DESC
        `);
      } else {
        throw dbError;
      }
    }

    res.json({
      success: true,
      users: result.rows.map((u) => ({
        ...u,
        user_type: u.user_type || 'user',
        isLocked: u.locked_until ? new Date(u.locked_until) > new Date() : false,
        lockedUntil: u.locked_until || null,
        failedAttempts: u.failed_login_attempts || 0,
        lockoutCount: u.lockout_count || 0,
        lastFailedLogin: u.last_failed_login || null,
      })),
    });
  } catch (error) {
    logger.error('Kullanıcı listeleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: 'Kullanıcılar yüklenemedi' });
  }
});

/**
 * PUT /users/:id - Kullanıcı güncelle (Admin)
 */
router.put('/users/:id', authenticate, requireAdmin, validate(updateUserSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, user_type, is_active } = req.body;

    let passwordHash = null;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    let finalRole = role;
    let finalUserType = user_type;

    if (user_type) {
      if (user_type === 'super_admin' || user_type === 'admin') {
        finalRole = 'admin';
      } else {
        finalRole = 'user';
      }
    } else if (role) {
      if (role === 'admin') {
        finalUserType = 'admin';
      } else {
        finalUserType = 'user';
      }
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email) {
      updateFields.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (passwordHash) {
      updateFields.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }
    if (finalRole) {
      updateFields.push(`role = $${paramCount++}`);
      values.push(finalRole);
    }
    if (finalUserType) {
      updateFields.push(`user_type = $${paramCount++}`);
      values.push(finalUserType);
    }
    if (typeof is_active === 'boolean') {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    updateFields.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `
      UPDATE users SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, user_type, is_active, created_at
    `,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Kullanıcı güncellendi',
      user: { ...result.rows[0], user_type: result.rows[0].user_type || 'user' },
    });
  } catch (error) {
    logger.error('Kullanıcı güncelleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /users/:id - Kullanıcı sil (Admin)
 */
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ success: false, error: 'Kendinizi silemezsiniz' });
    }

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }

    res.json({
      success: true,
      message: 'Kullanıcı silindi',
      user: result.rows[0],
    });
  } catch (error) {
    logger.error('Kullanıcı silme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /setup-super-admin - İlk super admin ataması
 */
router.post('/setup-super-admin', async (_req, res) => {
  try {
    const existing = await query(`SELECT id, name, email FROM users WHERE user_type = 'super_admin' LIMIT 1`);

    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Super Admin zaten mevcut',
        superAdmin: existing.rows[0],
      });
    }

    const result = await query(`
      UPDATE users SET user_type = 'super_admin'
      WHERE role = 'admin' AND id = (SELECT MIN(id) FROM users WHERE role = 'admin')
      RETURNING id, name, email, user_type
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Admin kullanici bulunamadi' });
    }

    res.json({
      success: true,
      message: 'Super Admin atandi',
      superAdmin: result.rows[0],
    });
  } catch (error) {
    logger.error('Super admin setup hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /users/:id/lock - Hesabı kilitle (Admin)
 */
router.put('/users/:id/lock', authenticate, requireAdmin, validate(lockAccountSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { minutes: lockMinutes } = req.body;

    const success = await loginAttemptService.lockAccount(parseInt(id, 10), lockMinutes);

    if (!success) {
      return res.status(500).json({ success: false, error: 'Hesap kilitlenemedi' });
    }

    const userStatus = await loginAttemptService.getUserStatus(parseInt(id, 10));

    res.json({
      success: true,
      message: 'Hesap kilitlendi',
      user: userStatus,
    });
  } catch (error) {
    logger.error('Hesap kilitleme hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /users/:id/unlock - Hesabı aç (Admin)
 */
router.put('/users/:id/unlock', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const success = await loginAttemptService.unlockAccount(parseInt(id, 10));

    if (!success) {
      return res.status(500).json({ success: false, error: 'Hesap açılamadı' });
    }

    const userStatus = await loginAttemptService.getUserStatus(parseInt(id, 10));

    res.json({
      success: true,
      message: 'Hesap açıldı',
      user: userStatus,
    });
  } catch (error) {
    logger.error('Hesap açma hatası', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /users/:id/login-attempts - Login geçmişi (Admin)
 */
router.get(
  '/users/:id/login-attempts',
  authenticate,
  requireAdmin,
  validate(loginAttemptsQuerySchema, 'query'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { limit } = req.query;

      const history = await loginAttemptService.getLoginHistory(parseInt(id, 10), limit);
      const userStatus = await loginAttemptService.getUserStatus(parseInt(id, 10));

      res.json({
        success: true,
        history,
        userStatus,
      });
    } catch (error) {
      logger.error('Login attempt geçmişi hatası', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DEPRECATED: Admin notification routes
 * Bu endpoint'ler geriye dönük uyumluluk için korunuyor.
 * Yeni kod için /api/notifications endpoint'lerini kullanın.
 * @deprecated Use /api/notifications with source=admin filter instead
 */

// Admin bildirimleri - Unified system'e yönlendir
router.get('/admin/notifications', (req, res) => {
  res.redirect(307, `/api/notifications?source=admin&limit=${req.query.limit || 50}`);
});

// Okunmamış bildirim sayısı - Unified system'e yönlendir
router.get('/admin/notifications/unread-count', (_req, res) => {
  res.redirect(307, '/api/notifications/unread-count');
});

// Bildirimi okundu işaretle - Unified system'e yönlendir
router.put('/admin/notifications/:id/read', (req, res) => {
  res.redirect(307, `/api/notifications/${req.params.id}/read`);
});

// Tüm bildirimleri okundu işaretle - Unified system'e yönlendir
router.put('/admin/notifications/read-all', (_req, res) => {
  res.redirect(307, '/api/notifications/read-all?source=admin');
});

// Bildirimi sil - Unified system'e yönlendir
router.delete('/admin/notifications/:id', (req, res) => {
  res.redirect(307, `/api/notifications/${req.params.id}`);
});

/**
 * GET /sessions - Aktif oturumları listele
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    let currentTokenHash = null;
    if (refreshToken) {
      currentTokenHash = hashToken(refreshToken);
    }

    const sessions = await sessionService.getUserSessions(req.user.id);

    const sessionsWithCurrent = sessions.map((session) => {
      const isCurrent = currentTokenHash && session.refreshTokenHash === currentTokenHash;
      return { ...session, isCurrent };
    });

    res.json({
      success: true,
      sessions: sessionsWithCurrent,
    });
  } catch (error) {
    logger.error('Get sessions error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /sessions/:id - Oturum sonlandır
 */
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const sessionId = parseInt(id, 10);

    const sessions = await sessionService.getUserSessions(userId);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      return res.status(404).json({ success: false, error: 'Oturum bulunamadı' });
    }

    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const currentSession = await sessionService.getSessionByToken(tokenHash);
      if (currentSession && currentSession.id === sessionId) {
        return res.status(400).json({ success: false, error: 'Mevcut oturumu sonlandıramazsınız. Çıkış yapın.' });
      }
    }

    const success = await sessionService.terminateSession(sessionId);

    if (!success) {
      return res.status(500).json({ success: false, error: 'Oturum sonlandırılamadı' });
    }

    res.json({
      success: true,
      message: 'Oturum sonlandırıldı',
    });
  } catch (error) {
    logger.error('Terminate session error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /sessions/other - Diğer tüm oturumları sonlandır
 */
router.delete('/sessions/other', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token bulunamadı' });
    }

    const tokenHash = hashToken(refreshToken);
    const count = await sessionService.terminateOtherSessions(userId, tokenHash);

    res.json({
      success: true,
      message: `${count} oturum sonlandırıldı`,
      count,
    });
  } catch (error) {
    logger.error('Terminate other sessions error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/ip-rules - IP kurallarını listele (Admin)
 */
router.get('/admin/ip-rules', authenticate, requireAdmin, async (req, res) => {
  try {
    const { type, active } = req.query;

    let queryText = `
      SELECT id, ip_address, type, description, created_by, created_at, updated_at, is_active
      FROM ip_access_rules WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (type) {
      queryText += ` AND type = $${paramCount++}`;
      params.push(type);
    }

    if (active !== undefined) {
      queryText += ` AND is_active = $${paramCount++}`;
      params.push(active === 'true');
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query(queryText, params);

    res.json({
      success: true,
      rules: result.rows.map((row) => ({
        id: row.id,
        ipAddress: row.ip_address,
        type: row.type,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active,
      })),
    });
  } catch (error) {
    logger.error('Get IP rules error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /admin/ip-rules - Yeni IP kuralı ekle (Admin)
 */
router.post('/admin/ip-rules', authenticate, requireAdmin, validate(createIpRuleSchema), async (req, res) => {
  try {
    const { ipAddress, type, description } = req.body;

    try {
      const result = await query(
        `INSERT INTO ip_access_rules (ip_address, type, description, created_by)
         VALUES ($1::cidr, $2, $3, $4)
         RETURNING id, ip_address, type, description, created_at`,
        [ipAddress, type, description || null, req.user.id]
      );

      res.json({
        success: true,
        message: 'IP kuralı eklendi',
        rule: {
          id: result.rows[0].id,
          ipAddress: result.rows[0].ip_address,
          type: result.rows[0].type,
          description: result.rows[0].description,
          createdAt: result.rows[0].created_at,
        },
      });
    } catch (dbError) {
      if (dbError.message.includes('invalid input syntax for type cidr')) {
        return res.status(400).json({
          success: false,
          error: 'Geçersiz IP adresi veya CIDR formatı. Örnek: 192.168.1.0/24 veya 10.0.0.1/32',
        });
      }
      throw dbError;
    }
  } catch (error) {
    logger.error('Create IP rule error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /admin/ip-rules/:id - IP kuralını güncelle (Admin)
 */
router.put('/admin/ip-rules/:id', authenticate, requireAdmin, validate(updateIpRuleSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { ipAddress, type, description, isActive } = req.body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (ipAddress) {
      updateFields.push(`ip_address = $${paramCount++}::cidr`);
      values.push(ipAddress);
    }

    if (type) {
      updateFields.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (typeof isActive === 'boolean') {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    updateFields.push('updated_at = NOW()');
    values.push(id);

    const result = await query(
      `UPDATE ip_access_rules SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, ip_address, type, description, is_active, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'IP kuralı bulunamadı' });
    }

    res.json({
      success: true,
      message: 'IP kuralı güncellendi',
      rule: {
        id: result.rows[0].id,
        ipAddress: result.rows[0].ip_address,
        type: result.rows[0].type,
        description: result.rows[0].description,
        isActive: result.rows[0].is_active,
        updatedAt: result.rows[0].updated_at,
      },
    });
  } catch (error) {
    logger.error('Update IP rule error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/ip-rules/:id - IP kuralını sil (Admin)
 */
router.delete('/admin/ip-rules/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM ip_access_rules WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'IP kuralı bulunamadı' });
    }

    res.json({
      success: true,
      message: 'IP kuralı silindi',
    });
  } catch (error) {
    logger.error('Delete IP rule error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
