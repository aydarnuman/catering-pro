/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kimlik doğrulama işlemleri
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import loginAttemptService from '../services/login-attempt-service.js';
import adminNotificationService from '../services/admin-notification-service.js';
import sessionService from '../services/session-service.js';

const router = express.Router();

// JWT_SECRET kontrolü - güvenlik için zorunlu
if (!process.env.JWT_SECRET) {
  logger.error('KRITIK: JWT_SECRET tanımlanmamış! Sunucu güvenli çalışamaz.');
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

// Token süreleri
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 dakika
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 gün
const COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 dakika (ms)
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 gün (ms)

// Şifre güçlülük kontrolü
const validatePassword = (password) => {
  const errors = [];
  if (password.length < 8) errors.push('En az 8 karakter gerekli');
  if (!/[A-Z]/.test(password)) errors.push('En az bir büyük harf gerekli');
  if (!/[a-z]/.test(password)) errors.push('En az bir küçük harf gerekli');
  if (!/[0-9]/.test(password)) errors.push('En az bir rakam gerekli');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('En az bir özel karakter gerekli (!@#$%^&* vb.)');
  return { valid: errors.length === 0, errors };
};

// Cookie ayarları
const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge,
  path: '/'
});

// Refresh token hash'leme
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     description: Email ve şifre ile giriş yaparak JWT token alır
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Giriş başarılı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin, user]
 *       400:
 *         description: Email veya şifre eksik
 *       401:
 *         description: Geçersiz email veya şifre
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli' });
    }
    
    // Önce kilit durumunu kontrol et
    const lockStatus = await loginAttemptService.checkLockStatusByEmail(email);
    
    if (lockStatus.isLocked) {
      const minutesRemaining = Math.ceil((lockStatus.lockedUntil.getTime() - Date.now()) / 60000);
      logger.warn('Login attempt blocked - account locked', { 
        email, 
        lockedUntil: lockStatus.lockedUntil,
        minutesRemaining 
      });
      
      return res.status(423).json({ 
        error: `Hesabınız kilitlendi. ${minutesRemaining} dakika sonra tekrar deneyin.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: lockStatus.lockedUntil.toISOString(),
        minutesRemaining
      });
    }
    
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      // Kullanıcı bulunamadı - attempt kaydetme (email yoksa kaydetmez)
      logger.warn('Login attempt failed - user not found', { email });
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    const user = result.rows[0];
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      // Başarısız login - attempt kaydet
      const attemptResult = await loginAttemptService.recordFailedLogin(email, ipAddress, userAgent);
      
      logger.warn('Login attempt failed - invalid password', { 
        email, 
        userId: user.id,
        remainingAttempts: attemptResult.remainingAttempts,
        isLocked: attemptResult.isLocked
      });
      
      // Hesap kilitlendiyse özel mesaj
      if (attemptResult.isLocked) {
        const minutesRemaining = attemptResult.lockedUntil 
          ? Math.ceil((attemptResult.lockedUntil.getTime() - Date.now()) / 60000)
          : 0;
        
        return res.status(423).json({ 
          error: `Çok fazla başarısız deneme. Hesabınız ${minutesRemaining} dakika kilitlendi.`,
          code: 'ACCOUNT_LOCKED',
          lockedUntil: attemptResult.lockedUntil?.toISOString(),
          minutesRemaining,
          remainingAttempts: 0
        });
      }
      
      return res.status(401).json({ 
        error: 'Geçersiz email veya şifre',
        remainingAttempts: attemptResult.remainingAttempts
      });
    }
    
    // Başarılı login - attempt'leri sıfırla
    await loginAttemptService.recordSuccessfulLogin(user.id, ipAddress, userAgent);
    
    logger.info('User logged in successfully', { userId: user.id, email: user.email, role: user.role });

    // Access token oluştur (kısa süreli)
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Refresh token oluştur (uzun süreli)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashToken(refreshToken);

    // Refresh token'ı veritabanına kaydet
    try {
      await query(`
        INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
      `, [
        user.id,
        refreshTokenHash,
        JSON.stringify({ userAgent: req.headers['user-agent'] }),
        req.ip
      ]);

      // Session oluştur (eşzamanlı limit kontrolü ile)
      try {
        const deviceInfo = sessionService.parseDeviceInfo(req.headers['user-agent']);
        await sessionService.createSession(
          user.id,
          refreshTokenHash,
          req.ip || ipAddress,
          req.headers['user-agent'] || userAgent,
          deviceInfo
        );
      } catch (sessionError) {
        // Session tablosu yoksa sessizce devam et (migration henüz çalışmamış olabilir)
        logger.warn('Session kaydedilemedi, tablo mevcut olmayabilir', { error: sessionError.message });
      }
    } catch (dbError) {
      // refresh_tokens tablosu yoksa sessizce devam et (migration henüz çalışmamış olabilir)
      logger.warn('Refresh token kaydedilemedi, tablo mevcut olmayabilir', { error: dbError.message });
    }

    // HttpOnly cookie'lere token'ları set et
    res.cookie('access_token', accessToken, getCookieOptions(COOKIE_MAX_AGE));
    res.cookie('refresh_token', refreshToken, getCookieOptions(REFRESH_COOKIE_MAX_AGE));

    res.json({
      success: true,
      token: accessToken, // Geriye uyumluluk için
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        user_type: user.user_type || 'user'
      }
    });
    
  } catch (error) {
    logger.error('Login hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı
 *     description: Yeni kullanıcı hesabı oluşturur (Admin yetkisi gerektirebilir)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "secure123"
 *               name:
 *                 type: string
 *                 example: "Ahmet Yılmaz"
 *               role:
 *                 type: string
 *                 enum: [admin, user]
 *                 default: user
 *     responses:
 *       200:
 *         description: Kullanıcı oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Eksik alan veya email zaten kullanımda
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role = 'user', user_type } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }
    
    // Email kontrolü
    const existing = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
    }
    
    // Şifre hash
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Kullanıcı tipini belirle (role'e göre varsayılan)
    // admin rolü -> admin user_type, aksi halde 'user'
    const finalUserType = user_type || (role === 'admin' ? 'admin' : 'user');
    
    // Kullanıcı oluştur
    const result = await query(`
      INSERT INTO users (email, password_hash, name, role, user_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, user_type
    `, [email, passwordHash, name, role, finalUserType]);
    
    res.json({
      success: true,
      message: 'Kullanıcı oluşturuldu',
      user: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Register hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Mevcut kullanıcı bilgisi
 *     description: JWT token ile giriş yapmış kullanıcının bilgilerini döner
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Token gerekli veya geçersiz
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const result = await query(
      'SELECT id, email, name, role, user_type, created_at FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        ...user,
        user_type: user.user_type || 'user'
      }
    });
    
  } catch (error) {
    logger.error('Auth hatası', { error: error.message });
    res.status(401).json({ error: 'Geçersiz token' });
  }
});

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Profil güncelleme
 *     description: Kullanıcının kendi profil bilgilerini günceller
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ahmet Yılmaz"
 *     responses:
 *       200:
 *         description: Profil güncellendi
 *       401:
 *         description: Token gerekli veya geçersiz
 */
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name } = req.body;
    
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Geçerli bir isim girin (en az 2 karakter)' });
    }
    
    const result = await query(`
      UPDATE users 
      SET name = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
      RETURNING id, email, name, role, created_at
    `, [name.trim(), decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Profil güncellendi',
      user: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Profil güncelleme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     summary: Şifre değiştirme
 *     description: Kullanıcının kendi şifresini değiştirir
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Şifre değiştirildi
 *       400:
 *         description: Mevcut şifre yanlış veya yeni şifre geçersiz
 *       401:
 *         description: Token gerekli veya geçersiz
 */
router.put('/password', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
    }
    
    // Şifre güçlülük kontrolü
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Şifre güvenlik gereksinimlerini karşılamıyor',
        details: passwordValidation.errors
      });
    }
    
    // Mevcut kullanıcıyı ve şifresini al
    const userResult = await query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const user = userResult.rows[0];
    
    // Mevcut şifreyi doğrula
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!validPassword) {
      return res.status(400).json({ error: 'Mevcut şifre yanlış' });
    }
    
    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);
    
    // Şifreyi güncelle
    await query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `, [newPasswordHash, decoded.id]);
    
    res.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    });
    
  } catch (error) {
    logger.error('Şifre değiştirme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN ENDPOINTS ==========

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Tüm kullanıcıları listele (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const result = await query(`
      SELECT id, email, name, role, user_type, is_active, 
             failed_login_attempts, locked_until, lockout_count, last_failed_login,
             created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      users: result.rows.map(u => ({
        ...u,
        user_type: u.user_type || 'user',
        isLocked: u.locked_until && new Date(u.locked_until) > new Date(),
        lockedUntil: u.locked_until,
        failedAttempts: u.failed_login_attempts || 0,
        lockoutCount: u.lockout_count || 0
      }))
    });
    
  } catch (error) {
    logger.error('Kullanıcı listeleme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}:
 *   put:
 *     summary: Kullanıcı güncelle (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    const { name, email, password, role, is_active } = req.body;
    
    // Şifre değişikliği varsa hashle
    let passwordHash = null;
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }
    
    // Kullanıcıyı güncelle
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
    if (role) {
      updateFields.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (typeof is_active === 'boolean') {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(id);
    
    const result = await query(`
      UPDATE users SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, is_active, created_at
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Kullanıcı güncellendi',
      user: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Kullanıcı güncelleme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Kullanıcı sil (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    
    // Kendini silemesin
    if (parseInt(id) === decoded.id) {
      return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
    }
    
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'Kullanıcı silindi',
      user: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Kullanıcı silme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Çıkış yap
 *     description: HttpOnly cookie'leri temizler ve refresh token'ı iptal eder
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Çıkış başarılı
 */
router.post('/logout', async (req, res) => {
  try {
    // Refresh token'ı iptal et
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      try {
        await query(`
          UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1
        `, [tokenHash]);
      } catch (dbError) {
        // Tablo yoksa sessizce devam et
        logger.debug('Refresh token revoke edilemedi', { error: dbError.message });
      }
    }

    // Cookie'leri temizle
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    res.json({ success: true, message: 'Çıkış yapıldı' });
  } catch (error) {
    logger.error('Logout hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Token yenileme
 *     description: Refresh token kullanarak yeni access token alır
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Yeni token oluşturuldu
 *       401:
 *         description: Refresh token geçersiz veya süresi dolmuş
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token bulunamadı' });
    }

    const tokenHash = hashToken(refreshToken);

    // Refresh token'ı veritabanında kontrol et
    let tokenRecord;
    try {
      const result = await query(`
        SELECT rt.*, u.email, u.role
        FROM refresh_tokens rt
        JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
          AND rt.expires_at > NOW()
          AND rt.revoked_at IS NULL
          AND u.is_active = true
      `, [tokenHash]);
      tokenRecord = result.rows[0];
    } catch (dbError) {
      // Tablo yoksa geriye uyumluluk için cookie'den devam et
      logger.warn('Refresh tokens tablosu mevcut değil', { error: dbError.message });
      return res.status(401).json({ error: 'Token yenileme henüz aktif değil' });
    }

    if (!tokenRecord) {
      // Cookie'yi temizle
      res.clearCookie('refresh_token', { path: '/' });
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş refresh token' });
    }

    // Session activity güncelle
    try {
      await sessionService.updateSessionActivity(tokenHash);
    } catch (sessionError) {
      // Session tablosu yoksa sessizce devam et
      logger.debug('Session activity güncellenemedi', { error: sessionError.message });
    }

    // Yeni access token oluştur
    const newAccessToken = jwt.sign(
      {
        id: tokenRecord.user_id,
        email: tokenRecord.email,
        role: tokenRecord.role,
        type: 'access'
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Yeni cookie set et
    res.cookie('access_token', newAccessToken, getCookieOptions(COOKIE_MAX_AGE));

    // Session bilgisini response'a ekle (frontend için)
    let currentSession = null;
    try {
      currentSession = await sessionService.getSessionByToken(tokenHash);
    } catch (sessionError) {
      // Session tablosu yoksa sessizce devam et
    }

    res.json({
      success: true,
      token: newAccessToken, // Geriye uyumluluk için
      message: 'Token yenilendi',
      currentSessionId: currentSession?.id || null
    });
  } catch (error) {
    logger.error('Token refresh hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/revoke-all:
 *   post:
 *     summary: Tüm oturumları kapat
 *     description: Kullanıcının tüm refresh token'larını iptal eder
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tüm oturumlar kapatıldı
 */
router.post('/revoke-all', async (req, res) => {
  try {
    // Token'ı cookie veya header'dan al
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Tüm refresh token'ları iptal et
    try {
      await query(`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
      `, [decoded.id]);
    } catch (dbError) {
      logger.warn('Refresh tokens tablosu mevcut değil', { error: dbError.message });
    }

    // Mevcut cookie'leri temizle
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    res.json({ success: true, message: 'Tüm oturumlar kapatıldı' });
  } catch (error) {
    logger.error('Revoke all hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/validate-password:
 *   post:
 *     summary: Şifre güçlülük kontrolü
 *     description: Şifrenin güvenlik gereksinimlerini karşılayıp karşılamadığını kontrol eder
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Şifre doğrulama sonucu
 */
router.post('/validate-password', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Şifre gerekli' });
  }

  const result = validatePassword(password);
  res.json({
    success: true,
    valid: result.valid,
    errors: result.errors,
    strength: result.errors.length === 0 ? 'strong' :
              result.errors.length <= 2 ? 'medium' : 'weak'
  });
});

/**
 * POST /api/auth/setup-super-admin
 * Ilk kurulum: Mevcut admin kullaniciyi super_admin yap
 * NOT: Bu endpoint sadece henuz super_admin yoksa calisir
 */
router.post('/setup-super-admin', async (req, res) => {
  try {
    // Zaten super_admin var mi kontrol et
    const existing = await query(`
      SELECT id, name, email FROM users WHERE user_type = 'super_admin' LIMIT 1
    `);
    
    if (existing.rows.length > 0) {
      return res.json({
        success: true,
        message: 'Super Admin zaten mevcut',
        superAdmin: existing.rows[0]
      });
    }
    
    // Ilk admin kullaniciyi super_admin yap
    const result = await query(`
      UPDATE users 
      SET user_type = 'super_admin' 
      WHERE role = 'admin'
      AND id = (SELECT MIN(id) FROM users WHERE role = 'admin')
      RETURNING id, name, email, user_type
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Admin kullanici bulunamadi' 
      });
    }
    
    res.json({
      success: true,
      message: 'Super Admin atandi',
      superAdmin: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Super admin setup hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}/lock:
 *   put:
 *     summary: Hesabı kilitle (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:id/lock', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    const { minutes } = req.body;
    const lockMinutes = minutes || 60; // Varsayılan 1 saat
    
    const success = await loginAttemptService.lockAccount(parseInt(id), lockMinutes);
    
    if (!success) {
      return res.status(500).json({ error: 'Hesap kilitlenemedi' });
    }
    
    const userStatus = await loginAttemptService.getUserStatus(parseInt(id));
    
    res.json({
      success: true,
      message: 'Hesap kilitlendi',
      user: userStatus
    });
    
  } catch (error) {
    logger.error('Hesap kilitleme hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}/unlock:
 *   put:
 *     summary: Hesabı aç (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/users/:id/unlock', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    
    const success = await loginAttemptService.unlockAccount(parseInt(id));
    
    if (!success) {
      return res.status(500).json({ error: 'Hesap açılamadı' });
    }
    
    const userStatus = await loginAttemptService.getUserStatus(parseInt(id));
    
    res.json({
      success: true,
      message: 'Hesap açıldı',
      user: userStatus
    });
    
  } catch (error) {
    logger.error('Hesap açma hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/users/{id}/login-attempts:
 *   get:
 *     summary: Login attempt geçmişi (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/users/:id/login-attempts', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await loginAttemptService.getLoginHistory(parseInt(id), limit);
    const userStatus = await loginAttemptService.getUserStatus(parseInt(id));
    
    res.json({
      success: true,
      history,
      userStatus
    });
    
  } catch (error) {
    logger.error('Login attempt geçmişi hatası', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/notifications:
 *   get:
 *     summary: Admin bildirimlerini listele
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/notifications', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { limit, read, type, severity } = req.query;
    
    const notifications = await adminNotificationService.getNotifications({
      limit: limit ? parseInt(limit) : 50,
      read: read === 'true' ? true : read === 'false' ? false : null,
      type: type || null,
      severity: severity || null
    });
    
    res.json({
      success: true,
      notifications
    });
    
  } catch (error) {
    logger.error('Admin notifications list error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/notifications/unread-count:
 *   get:
 *     summary: Okunmamış bildirim sayısı
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/notifications/unread-count', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const count = await adminNotificationService.getUnreadCount();
    
    res.json({
      success: true,
      count
    });
    
  } catch (error) {
    logger.error('Unread count error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/notifications/{id}/read:
 *   put:
 *     summary: Bildirimi okundu işaretle
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/notifications/:id/read', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    const success = await adminNotificationService.markAsRead(parseInt(id));
    
    if (!success) {
      return res.status(500).json({ error: 'Bildirim okundu işaretlenemedi' });
    }
    
    res.json({
      success: true,
      message: 'Bildirim okundu işaretlendi'
    });
    
  } catch (error) {
    logger.error('Mark as read error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/notifications/read-all:
 *   put:
 *     summary: Tüm bildirimleri okundu işaretle
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/notifications/read-all', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const count = await adminNotificationService.markAllAsRead();
    
    res.json({
      success: true,
      message: `${count} bildirim okundu işaretlendi`,
      count
    });
    
  } catch (error) {
    logger.error('Mark all as read error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/notifications/{id}:
 *   delete:
 *     summary: Bildirimi sil
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/admin/notifications/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    const success = await adminNotificationService.deleteNotification(parseInt(id));
    
    if (!success) {
      return res.status(500).json({ error: 'Bildirim silinemedi' });
    }
    
    res.json({
      success: true,
      message: 'Bildirim silindi'
    });
    
  } catch (error) {
    logger.error('Delete notification error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Aktif oturumları listele
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sessions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    
    // Mevcut refresh token hash'ini al
    const refreshToken = req.cookies?.refresh_token;
    let currentTokenHash = null;
    if (refreshToken) {
      currentTokenHash = hashToken(refreshToken);
    }
    
    const sessions = await sessionService.getUserSessions(userId);
    
    // Mevcut session'ı işaretle
    const sessionsWithCurrent = sessions.map(session => {
      const isCurrent = currentTokenHash && session.refreshTokenHash === currentTokenHash;
      return { ...session, isCurrent };
    });
    
    res.json({
      success: true,
      sessions: sessionsWithCurrent
    });
    
  } catch (error) {
    logger.error('Get sessions error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/sessions/{id}:
 *   delete:
 *     summary: Oturum sonlandır
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    const { id } = req.params;
    const sessionId = parseInt(id);
    
    // Session'ın kullanıcıya ait olduğunu kontrol et
    const sessions = await sessionService.getUserSessions(userId);
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Oturum bulunamadı' });
    }
    
    // Mevcut session'ı sonlandırmaya çalışıyorsa özel kontrol
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const currentSession = await sessionService.getSessionByToken(tokenHash);
      if (currentSession && currentSession.id === sessionId) {
        return res.status(400).json({ error: 'Mevcut oturumu sonlandıramazsınız. Çıkış yapın.' });
      }
    }
    
    const success = await sessionService.terminateSession(sessionId);
    
    if (!success) {
      return res.status(500).json({ error: 'Oturum sonlandırılamadı' });
    }
    
    res.json({
      success: true,
      message: 'Oturum sonlandırıldı'
    });
    
  } catch (error) {
    logger.error('Terminate session error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/sessions/other:
 *   delete:
 *     summary: Diğer tüm oturumları sonlandır
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/sessions/other', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;
    
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token bulunamadı' });
    }
    
    const tokenHash = hashToken(refreshToken);
    const count = await sessionService.terminateOtherSessions(userId, tokenHash);
    
    res.json({
      success: true,
      message: `${count} oturum sonlandırıldı`,
      count
    });
    
  } catch (error) {
    logger.error('Terminate other sessions error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/ip-rules:
 *   get:
 *     summary: IP kurallarını listele (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/ip-rules', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { type, active } = req.query;
    
    let queryText = `
      SELECT id, ip_address, type, description, created_by, created_at, updated_at, is_active
      FROM ip_access_rules
      WHERE 1=1
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
      rules: result.rows.map(row => ({
        id: row.id,
        ipAddress: row.ip_address,
        type: row.type,
        description: row.description,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isActive: row.is_active
      }))
    });
    
  } catch (error) {
    logger.error('Get IP rules error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/ip-rules:
 *   post:
 *     summary: Yeni IP kuralı ekle (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/ip-rules', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { ipAddress, type, description } = req.body;
    
    if (!ipAddress || !type) {
      return res.status(400).json({ error: 'IP adresi ve tip gerekli' });
    }
    
    if (!['whitelist', 'blacklist'].includes(type)) {
      return res.status(400).json({ error: 'Tip whitelist veya blacklist olmalı' });
    }
    
    // CIDR formatını kontrol et
    try {
      // PostgreSQL CIDR tipi otomatik validate eder
      const result = await query(
        `INSERT INTO ip_access_rules (ip_address, type, description, created_by)
         VALUES ($1::cidr, $2, $3, $4)
         RETURNING id, ip_address, type, description, created_at`,
        [ipAddress, type, description || null, decoded.id]
      );
      
      res.json({
        success: true,
        message: 'IP kuralı eklendi',
        rule: {
          id: result.rows[0].id,
          ipAddress: result.rows[0].ip_address,
          type: result.rows[0].type,
          description: result.rows[0].description,
          createdAt: result.rows[0].created_at
        }
      });
    } catch (dbError) {
      if (dbError.message.includes('invalid input syntax for type cidr')) {
        return res.status(400).json({ 
          error: 'Geçersiz IP adresi veya CIDR formatı. Örnek: 192.168.1.0/24 veya 10.0.0.1/32' 
        });
      }
      throw dbError;
    }
    
  } catch (error) {
    logger.error('Create IP rule error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/ip-rules/{id}:
 *   put:
 *     summary: IP kuralını güncelle (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/ip-rules/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
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
      if (!['whitelist', 'blacklist'].includes(type)) {
        return res.status(400).json({ error: 'Tip whitelist veya blacklist olmalı' });
      }
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
      `UPDATE ip_access_rules 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, ip_address, type, description, is_active, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IP kuralı bulunamadı' });
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
        updatedAt: result.rows[0].updated_at
      }
    });
    
  } catch (error) {
    logger.error('Update IP rule error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/admin/ip-rules/{id}:
 *   delete:
 *     summary: IP kuralını sil (Admin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/admin/ip-rules/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token gerekli' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM ip_access_rules WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IP kuralı bulunamadı' });
    }
    
    res.json({
      success: true,
      message: 'IP kuralı silindi'
    });
    
  } catch (error) {
    logger.error('Delete IP rule error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
