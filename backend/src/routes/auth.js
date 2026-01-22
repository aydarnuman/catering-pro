/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Kimlik doğrulama işlemleri
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const router = express.Router();

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
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli' });
    }
    
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    const user = result.rows[0];
    
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Admin kontrolü
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli' });
    }
    
    const result = await query(`
      SELECT id, email, name, role, user_type, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json({
      success: true,
      users: result.rows.map(u => ({
        ...u,
        user_type: u.user_type || 'user'
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
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
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
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

export default router;
