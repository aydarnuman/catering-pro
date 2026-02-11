/**
 * Cariler (Customers/Suppliers) Validation Schemas
 */

import { z } from 'zod';

const cariTipEnum = z.enum(['musteri', 'tedarikci', 'hem_musteri_hem_tedarikci', 'diger'], {
  errorMap: () => ({ message: 'Tip musteri, tedarikci, hem_musteri_hem_tedarikci veya diger olmalı' }),
});

export const createCariSchema = z.object({
  tip: cariTipEnum,
  unvan: z
    .string({ required_error: 'Ünvan gerekli' })
    .min(1, 'Ünvan gerekli')
    .max(255, 'Ünvan 255 karakterden uzun olamaz'),
  yetkili: z.string().max(100).optional(),
  vergi_no: z.string().max(20, 'Vergi no 20 karakterden uzun olamaz').optional().or(z.literal('')),
  vergi_dairesi: z.string().max(100).optional(),
  telefon: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Geçersiz email').max(255).optional().or(z.literal('')),
  adres: z.string().max(500).optional(),
  il: z.string().max(50).optional(),
  ilce: z.string().max(50).optional(),
  borc: z.number().min(0).default(0),
  alacak: z.number().min(0).default(0),
  kredi_limiti: z.number().min(0).default(0),
  banka_adi: z.string().max(100).optional(),
  iban: z.string().max(34).optional().or(z.literal('')),
  notlar: z.string().max(2000).optional(),
  etiket: z.string().max(100).optional(),
});

export const updateCariSchema = z
  .object({
    tip: cariTipEnum.optional(),
    unvan: z.string().min(1).max(255).optional(),
    yetkili: z.string().max(100).optional(),
    vergi_no: z.string().max(20).optional().or(z.literal('')),
    vergi_dairesi: z.string().max(100).optional(),
    telefon: z.string().max(30).optional().or(z.literal('')),
    email: z.string().email('Geçersiz email').max(255).optional().or(z.literal('')),
    adres: z.string().max(500).optional(),
    il: z.string().max(50).optional(),
    ilce: z.string().max(50).optional(),
    kredi_limiti: z.number().min(0).optional(),
    banka_adi: z.string().max(100).optional(),
    iban: z.string().max(34).optional().or(z.literal('')),
    notlar: z.string().max(2000).optional(),
    etiket: z.string().max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'En az bir alan güncellenmeli',
  });
