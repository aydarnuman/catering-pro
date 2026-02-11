/**
 * Auth Endpoint Validation Schemas
 * Zod ile input doğrulama
 */

import { z } from 'zod';

// ─── Ortak alanlar ───────────────────────────────────────────

const emailField = z
  .string({ required_error: 'Email gerekli' })
  .email('Geçerli bir email adresi girin')
  .max(255, 'Email 255 karakterden uzun olamaz')
  .transform((v) => v.toLowerCase().trim());

/** Şifre güçlülük kuralları (auth.js içindeki validatePassword ile aynı) */
const strongPassword = z
  .string({ required_error: 'Şifre gerekli' })
  .min(8, 'En az 8 karakter gerekli')
  .max(128, 'Şifre 128 karakterden uzun olamaz')
  .refine((p) => /[A-Z]/.test(p), 'En az bir büyük harf gerekli')
  .refine((p) => /[a-z]/.test(p), 'En az bir küçük harf gerekli')
  .refine((p) => /[0-9]/.test(p), 'En az bir rakam gerekli')
  .refine((p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p), 'En az bir özel karakter gerekli');

const nameField = z
  .string({ required_error: 'İsim gerekli' })
  .min(2, 'İsim en az 2 karakter olmalı')
  .max(100, 'İsim 100 karakterden uzun olamaz')
  .transform((v) => v.trim());

const roleEnum = z.enum(['admin', 'user'], {
  errorMap: () => ({ message: 'Rol admin veya user olmalı' }),
});

const userTypeEnum = z.enum(['super_admin', 'admin', 'user'], {
  errorMap: () => ({ message: 'Kullanıcı tipi super_admin, admin veya user olmalı' }),
});

// ─── Login ───────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  password: z.string({ required_error: 'Şifre gerekli' }).min(1, 'Şifre gerekli'),
});

// ─── Register ────────────────────────────────────────────────

export const registerSchema = z.object({
  email: emailField,
  password: strongPassword,
  name: nameField,
  role: roleEnum.optional().default('user'),
  user_type: userTypeEnum.optional(),
});

// ─── Profil güncelleme ───────────────────────────────────────

export const updateProfileSchema = z.object({
  name: nameField,
});

// ─── Şifre değiştirme ───────────────────────────────────────

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Mevcut şifre gerekli' }).min(1, 'Mevcut şifre gerekli'),
  newPassword: strongPassword,
});

// ─── Admin: Kullanıcı güncelleme ─────────────────────────────

export const updateUserSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
    password: z
      .string()
      .min(8, 'Şifre en az 8 karakter olmalı')
      .max(128, 'Şifre 128 karakterden uzun olamaz')
      .optional(),
    role: roleEnum.optional(),
    user_type: userTypeEnum.optional(),
    is_active: z.boolean({ invalid_type_error: 'is_active boolean olmalı' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });

// ─── Admin: Hesap kilitleme ──────────────────────────────────

export const lockAccountSchema = z.object({
  minutes: z.number().int().min(1, 'En az 1 dakika').max(43200, 'En fazla 30 gün (43200 dakika)').optional().default(60),
});

// ─── Admin: Login denemeleri sorgusu ─────────────────────────

export const loginAttemptsQuerySchema = z.object({
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(500))
    .optional()
    .default('50'),
});

// ─── Admin: IP kuralı oluşturma ──────────────────────────────

export const createIpRuleSchema = z.object({
  ipAddress: z
    .string({ required_error: 'IP adresi gerekli' })
    .min(1, 'IP adresi gerekli')
    .max(50, 'IP adresi 50 karakterden uzun olamaz'),
  type: z.enum(['whitelist', 'blacklist'], {
    errorMap: () => ({ message: 'Tip whitelist veya blacklist olmalı' }),
  }),
  description: z.string().max(500, 'Açıklama 500 karakterden uzun olamaz').optional(),
});

// ─── Admin: IP kuralı güncelleme ─────────────────────────────

export const updateIpRuleSchema = z
  .object({
    ipAddress: z.string().min(1).max(50).optional(),
    type: z.enum(['whitelist', 'blacklist']).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean({ invalid_type_error: 'isActive boolean olmalı' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });

// ─── Şifre doğrulama (validate-password endpoint) ───────────

export const validatePasswordSchema = z.object({
  password: z.string({ required_error: 'Şifre gerekli' }).min(1, 'Şifre gerekli'),
});

// ─── Params: ID doğrulama ────────────────────────────────────

export const idParamSchema = z.object({
  id: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive('Geçerli bir ID gerekli')),
});
