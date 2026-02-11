/**
 * Bordro (Payroll) Validation Schemas
 */

import { z } from 'zod';

const yilField = z.number().int().min(2020, 'Yıl 2020-2100 arası olmalı').max(2100);
const ayField = z.number().int().min(1, 'Ay 1-12 arası olmalı').max(12);
const tutarField = z.number().min(0).max(99999999);

// ─── Net → Brüt hesaplama ────────────────────────────────────

export const netBrutSchema = z.object({
  net_maas: z.number({ required_error: 'Net maaş gerekli' }).positive('Net maaş 0\'dan büyük olmalı'),
  medeni_durum: z.enum(['bekar', 'evli']).optional().default('bekar'),
  es_calisiyormu: z.boolean().optional().default(false),
  cocuk_sayisi: z.number().int().min(0).max(20).optional().default(0),
  yemek_yardimi: tutarField.optional().default(0),
  yol_yardimi: tutarField.optional().default(0),
});

// ─── Tekil bordro hesaplama ──────────────────────────────────

export const hesaplaSchema = z.object({
  personel_id: z.union([
    z.number().int().positive(),
    z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().positive()),
  ]),
  yil: yilField,
  ay: ayField,
  brut_maas: z.number({ required_error: 'Brüt maaş gerekli' }).positive('Brüt maaş 0\'dan büyük olmalı'),
  fazla_mesai_saat: z.number().min(0).max(744).optional().default(0),
  fazla_mesai_carpan: z.number().min(1).max(5).optional().default(1.5),
  ikramiye: tutarField.optional().default(0),
  prim: tutarField.optional().default(0),
  yemek_yardimi: tutarField.optional().default(0),
  yol_yardimi: tutarField.optional().default(0),
  diger_kazanc: tutarField.optional().default(0),
  calisma_gunu: z.number().int().min(0).max(31).optional().default(30),
});

// ─── Bordro kaydetme ─────────────────────────────────────────

export const kaydetSchema = z.object({
  personel_id: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  yil: yilField,
  ay: ayField,
  calisma_gunu: z.number().int().min(0).max(31).optional(),
  fazla_mesai_saat: z.number().min(0).optional(),
  brut_maas: z.number({ required_error: 'Brüt maaş gerekli' }).positive(),
  fazla_mesai_ucret: tutarField.optional(),
  ikramiye: tutarField.optional(),
  prim: tutarField.optional(),
  yemek_yardimi: tutarField.optional(),
  yol_yardimi: tutarField.optional(),
  diger_kazanc: tutarField.optional(),
  brut_toplam: z.number({ required_error: 'Brüt toplam gerekli' }).min(0),
  sgk_matrahi: z.number({ required_error: 'SGK matrahı gerekli' }).min(0),
  sgk_isci: z.number().min(0),
  issizlik_isci: z.number().min(0),
  toplam_isci_sgk: z.number().min(0),
  vergi_matrahi: z.number().min(0),
  kumulatif_matrah: z.number().min(0),
  gelir_vergisi: z.number().min(0),
  damga_vergisi: z.number().min(0),
  agi_tutari: z.number().min(0),
  net_maas: z.number({ required_error: 'Net maaş gerekli' }).min(0),
  sgk_isveren: z.number().min(0),
  issizlik_isveren: z.number().min(0),
  toplam_isveren_sgk: z.number().min(0),
  toplam_maliyet: z.number().min(0),
});

// ─── Toplu hesaplama ─────────────────────────────────────────

export const topluHesaplaSchema = z.object({
  yil: yilField,
  ay: ayField,
  proje_id: z.number().int().positive().optional().nullable(),
});

// ─── Ödeme durumu güncelleme ─────────────────────────────────

export const odemeSchema = z.object({
  odeme_durumu: z.enum(['beklemede', 'odendi', 'iptal'], {
    errorMap: () => ({ message: 'Ödeme durumu beklemede, odendi veya iptal olmalı' }),
  }),
  odeme_tarihi: z.string().optional(),
  odeme_yontemi: z.enum(['banka', 'nakit', 'havale']).optional(),
});

// ─── Toplu ödeme ─────────────────────────────────────────────

export const topluOdemeSchema = z.object({
  bordro_ids: z
    .array(z.number().int().positive(), { required_error: 'Bordro ID listesi gerekli' })
    .min(1, 'En az bir bordro seçilmeli'),
  odeme_yontemi: z.enum(['banka', 'nakit', 'havale']).optional().default('banka'),
});

// ─── Dönem silme ─────────────────────────────────────────────

export const donemSilSchema = z.object({
  yil: yilField,
  ay: ayField,
  proje_id: z.number().int().positive().optional().nullable(),
});
