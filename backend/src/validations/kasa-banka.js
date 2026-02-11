/**
 * Kasa-Banka Validation Schemas
 */

import { z } from 'zod';

// ─── Hesap (Account) ─────────────────────────────────────────

const hesapTipiEnum = z.enum(['kasa', 'banka', 'kredi_karti', 'pos'], {
  errorMap: () => ({ message: 'Hesap tipi kasa, banka, kredi_karti veya pos olmalı' }),
});

export const createHesapSchema = z.object({
  tip: hesapTipiEnum.optional(),
  ad: z.string().max(100).optional(),
  hesap_tipi: hesapTipiEnum.optional(),
  hesap_adi: z.string().max(100).optional(),
  banka_adi: z.string().max(100).optional(),
  sube: z.string().max(100).optional(),
  hesap_no: z.string().max(50).optional(),
  iban: z.string().max(34, 'IBAN 34 karakterden uzun olamaz').optional().or(z.literal('')),
  para_birimi: z.enum(['TRY', 'USD', 'EUR', 'GBP']).optional().default('TRY'),
  bakiye: z.number().default(0),
  kredi_limiti: z.number().min(0, 'Kredi limiti negatif olamaz').default(0),
  aktif: z.boolean().optional().default(true),
  kart_limiti: z.number().min(0).default(0),
  hesap_kesim_gunu: z.number().int().min(1).max(31).optional(),
  son_odeme_gunu: z.number().int().min(1).max(31).optional(),
});

export const updateHesapSchema = createHesapSchema;

// ─── Hareket (Movement/Transaction) ─────────────────────────

const hareketTipiEnum = z.enum(['giris', 'cikis'], {
  errorMap: () => ({ message: 'Hareket tipi giris veya cikis olmalı' }),
});

export const createHareketSchema = z.object({
  hesap_id: z.number({ required_error: 'Hesap ID gerekli' }).int().positive('Geçerli bir hesap ID gerekli'),
  hareket_tipi: hareketTipiEnum,
  tutar: z.number({ required_error: 'Tutar gerekli' }).positive("Tutar 0'dan büyük olmalı"),
  aciklama: z.string().max(500).optional(),
  belge_no: z.string().max(50).optional(),
  tarih: z.string().optional(),
  cari_id: z.number().int().positive().optional().nullable(),
});

// ─── Transfer ────────────────────────────────────────────────

export const createTransferSchema = z
  .object({
    kaynak_hesap_id: z.number({ required_error: 'Kaynak hesap ID gerekli' }).int().positive(),
    hedef_hesap_id: z.number({ required_error: 'Hedef hesap ID gerekli' }).int().positive(),
    tutar: z.number({ required_error: 'Tutar gerekli' }).positive("Tutar 0'dan büyük olmalı"),
    aciklama: z.string().max(500).optional(),
    tarih: z.string().optional(),
  })
  .refine((data) => data.kaynak_hesap_id !== data.hedef_hesap_id, {
    message: 'Kaynak ve hedef hesap aynı olamaz',
    path: ['hedef_hesap_id'],
  });

// ─── Çek/Senet ───────────────────────────────────────────────

const cekSenetTipEnum = z.enum(['cek', 'senet'], {
  errorMap: () => ({ message: 'Tip cek veya senet olmalı' }),
});

const cekSenetYonuEnum = z.enum(['alinan', 'verilen'], {
  errorMap: () => ({ message: 'Yönü alinan veya verilen olmalı' }),
});

export const createCekSenetSchema = z.object({
  tip: cekSenetTipEnum,
  yonu: cekSenetYonuEnum,
  belge_no: z.string().max(50).optional(),
  seri_no: z.string().max(50).optional(),
  tutar: z.number({ required_error: 'Tutar gerekli' }).positive("Tutar 0'dan büyük olmalı"),
  doviz: z.enum(['TRY', 'USD', 'EUR', 'GBP']).optional().default('TRY'),
  kesim_tarihi: z.string().optional(),
  vade_tarihi: z.string().optional(),
  banka_adi: z.string().max(100).optional(),
  sube_adi: z.string().max(100).optional(),
  sube_kodu: z.string().max(20).optional(),
  hesap_no: z.string().max(50).optional(),
  kesen_unvan: z.string().max(255).optional(),
  kesen_vkn_tckn: z.string().max(20).optional(),
  cari_id: z.number().int().positive().optional().nullable(),
  notlar: z.string().max(1000).optional(),
});

export const tahsilCekSenetSchema = z.object({
  hesap_id: z.number({ required_error: 'Hesap ID gerekli' }).int().positive(),
  tarih: z.string().optional(),
  aciklama: z.string().max(500).optional(),
});

export const ciroCekSenetSchema = z.object({
  ciro_cari_id: z.number({ required_error: 'Ciro cari ID gerekli' }).int().positive(),
  tarih: z.string().optional(),
  aciklama: z.string().max(500).optional(),
});

export const iadeCekSenetSchema = z.object({
  neden: z.string().max(500).optional(),
  tarih: z.string().optional(),
});
