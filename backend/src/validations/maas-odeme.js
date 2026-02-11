/**
 * Maaş Ödeme Validation Schemas
 */

import { z } from 'zod';

// ─── Ortak alanlar ───────────────────────────────────────────

const yilField = z.number().int().min(2020, 'Yıl 2020-2100 arası olmalı').max(2100);
const ayField = z.number().int().min(1, 'Ay 1-12 arası olmalı').max(12);
const tutarField = z.number().min(0, 'Tutar negatif olamaz').max(9999999, 'Tutar çok yüksek');

// ─── Ödendi işaretleme ──────────────────────────────────────

export const odendiSchema = z.object({
  tip: z.enum(['banka', 'elden'], {
    errorMap: () => ({ message: 'Tip banka veya elden olmalı' }),
  }),
  odendi: z.boolean({ required_error: 'Ödendi durumu gerekli' }),
});

// ─── Personel ödeme güncelleme ───────────────────────────────

export const personelOdemeSchema = z.object({
  proje_id: z.number({ required_error: 'Proje ID gerekli' }).int().positive(),
  yil: yilField,
  ay: ayField,
  elden_fark: tutarField.optional(),
  avans: tutarField.optional(),
  prim: tutarField.optional(),
});

// ─── Avans ───────────────────────────────────────────────────

export const avansSchema = z.object({
  personel_id: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  proje_id: z.number({ required_error: 'Proje ID gerekli' }).int().positive(),
  tutar: z.number({ required_error: 'Tutar gerekli' }).positive("Tutar 0'dan büyük olmalı"),
  tarih: z.string({ required_error: 'Tarih gerekli' }),
  aciklama: z.string().max(500).optional(),
  odeme_sekli: z.enum(['nakit', 'banka', 'havale']).optional().default('nakit'),
  mahsup_ay: ayField.optional(),
  mahsup_yil: yilField.optional(),
});

// ─── Prim ────────────────────────────────────────────────────

export const primSchema = z.object({
  personel_id: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  proje_id: z.number({ required_error: 'Proje ID gerekli' }).int().positive(),
  tutar: z.number({ required_error: 'Tutar gerekli' }).positive("Tutar 0'dan büyük olmalı"),
  tarih: z.string({ required_error: 'Tarih gerekli' }),
  prim_turu: z.string({ required_error: 'Prim türü gerekli' }).max(100),
  aciklama: z.string().max(500).optional(),
  odeme_ay: ayField.optional(),
  odeme_yil: yilField.optional(),
});

// ─── Personel maaş detay güncelleme ─────────────────────────

export const personelMaasDetaySchema = z.object({
  avans: tutarField.optional(),
  prim: tutarField.optional(),
  fazla_mesai: tutarField.optional(),
  notlar: z.string().max(1000).optional(),
});

// ─── Proje ayarları ──────────────────────────────────────────

export const projeAyarlariSchema = z.object({
  odeme_gunu: z.number().int().min(1).max(31).optional().default(15),
  banka_adi: z.string().max(100).optional(),
  iban: z.string().max(34).optional().or(z.literal('')),
});

// ─── Aylık ödeme durumu ──────────────────────────────────────

export const aylikOdemeSchema = z.object({
  field: z.enum(
    [
      'maas_banka_odendi',
      'maas_elden_odendi',
      'sgk_odendi',
      'gelir_vergisi_odendi',
      'damga_vergisi_odendi',
      'issizlik_odendi',
    ],
    { errorMap: () => ({ message: 'Geçersiz ödeme alanı' }) }
  ),
  odendi: z.boolean({ required_error: 'Ödendi durumu gerekli' }),
});

// ─── Finalize ────────────────────────────────────────────────

export const finalizeSchema = z.object({
  maas: z.number().min(0).default(0),
  sgk: z.number().min(0).default(0),
  vergi: z.number().min(0).default(0),
});
