/**
 * Personel Validation Schemas
 */

import { z } from 'zod';

const tcKimlikField = z
  .string({ required_error: 'TC kimlik numarası gerekli' })
  .length(11, 'TC kimlik numarası 11 haneli olmalı')
  .regex(/^\d{11}$/, 'TC kimlik numarası sadece rakam içermeli');

const durumEnum = z.enum(['aktif', 'pasif', 'izinli', 'cikis'], {
  errorMap: () => ({ message: 'Durum aktif, pasif, izinli veya cikis olmalı' }),
});

const medeniDurumEnum = z.enum(['bekar', 'evli'], {
  errorMap: () => ({ message: 'Medeni durum bekar veya evli olmalı' }),
});

const tutarField = z.number().min(0).max(99999999);

// ─── Personel oluşturma ──────────────────────────────────────

export const createPersonelSchema = z.object({
  ad: z.string({ required_error: 'Ad gerekli' }).min(1, 'Ad gerekli').max(100),
  soyad: z.string({ required_error: 'Soyad gerekli' }).min(1, 'Soyad gerekli').max(100),
  tc_kimlik: tcKimlikField,
  telefon: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Geçersiz email').max(255).optional().or(z.literal('')),
  adres: z.string().max(500).optional(),
  departman: z.string().max(100).optional(),
  pozisyon: z.string().max(100).optional(),
  ise_giris_tarihi: z.string({ required_error: 'İşe giriş tarihi gerekli' }),
  maas: tutarField.optional().default(0),
  maas_tipi: z.enum(['aylik', 'gunluk', 'saatlik']).optional().default('aylik'),
  iban: z.string().max(34).optional().or(z.literal('')),
  dogum_tarihi: z.string().optional().or(z.literal('')),
  cinsiyet: z.enum(['erkek', 'kadin']).optional(),
  notlar: z.string().max(2000).optional(),
  sicil_no: z.string().max(50).optional(),
  acil_kisi: z.string().max(100).optional(),
  acil_telefon: z.string().max(30).optional(),
  durum: durumEnum.optional().default('aktif'),
  medeni_durum: medeniDurumEnum.optional().default('bekar'),
  es_calisiyormu: z.boolean().optional().default(false),
  cocuk_sayisi: z.number().int().min(0).max(20).optional().default(0),
  engel_derecesi: z.number().int().min(0).max(3).optional().default(0),
  sgk_no: z.string().max(30).optional(),
  yemek_yardimi: tutarField.optional().default(0),
  yol_yardimi: tutarField.optional().default(0),
});

// ─── Personel güncelleme ─────────────────────────────────────

export const updatePersonelSchema = z.object({
  ad: z.string().min(1).max(100).optional(),
  soyad: z.string().min(1).max(100).optional(),
  tc_kimlik: tcKimlikField.optional(),
  telefon: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Geçersiz email').max(255).optional().or(z.literal('')),
  adres: z.string().max(500).optional(),
  departman: z.string().max(100).optional(),
  pozisyon: z.string().max(100).optional(),
  ise_giris_tarihi: z.string().optional(),
  isten_cikis_tarihi: z.string().optional().nullable(),
  maas: tutarField.optional(),
  maas_tipi: z.enum(['aylik', 'gunluk', 'saatlik']).optional(),
  iban: z.string().max(34).optional().or(z.literal('')),
  dogum_tarihi: z.string().optional().or(z.literal('')).nullable(),
  cinsiyet: z.enum(['erkek', 'kadin']).optional(),
  notlar: z.string().max(2000).optional(),
  sicil_no: z.string().max(50).optional(),
  acil_kisi: z.string().max(100).optional(),
  acil_telefon: z.string().max(30).optional(),
  durum: durumEnum.optional(),
  medeni_durum: medeniDurumEnum.optional(),
  es_calisiyormu: z.boolean().optional(),
  cocuk_sayisi: z.number().int().min(0).max(20).optional(),
  engel_derecesi: z.number().int().min(0).max(3).optional(),
  sgk_no: z.string().max(30).optional(),
  yemek_yardimi: tutarField.optional(),
  yol_yardimi: tutarField.optional(),
});

// ─── Proje oluşturma ─────────────────────────────────────────

export const createProjeSchema = z.object({
  ad: z.string({ required_error: 'Proje adı gerekli' }).min(1, 'Proje adı gerekli').max(200),
  kod: z.string().max(50).optional(),
  aciklama: z.string().max(1000).optional(),
  musteri: z.string().max(200).optional(),
  lokasyon: z.string().max(200).optional(),
  baslangic_tarihi: z.string().optional(),
  bitis_tarihi: z.string().optional().nullable(),
  butce: z.number().min(0).max(999999999).optional().default(0),
  durum: z.enum(['aktif', 'pasif', 'tamamlandi']).optional().default('aktif'),
});

export const updateProjeSchema = z.object({
  ad: z.string().min(1).max(200).optional(),
  kod: z.string().max(50).optional(),
  aciklama: z.string().max(1000).optional(),
  musteri: z.string().max(200).optional(),
  lokasyon: z.string().max(200).optional(),
  baslangic_tarihi: z.string().optional(),
  bitis_tarihi: z.string().optional().nullable(),
  butce: z.number().min(0).max(999999999).optional(),
  durum: z.enum(['aktif', 'pasif', 'tamamlandi']).optional(),
});

// ─── Proje-Personel atama ────────────────────────────────────

export const atamaSchema = z.object({
  personel_id: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  gorev: z.string().max(100).optional(),
  baslangic_tarihi: z.string().optional(),
  bitis_tarihi: z.string().optional().nullable(),
  notlar: z.string().max(1000).optional(),
});

export const topluAtamaSchema = z.object({
  personel_ids: z
    .array(z.number().int().positive(), { required_error: 'Personel ID listesi gerekli' })
    .min(1, 'En az bir personel seçilmeli'),
  gorev: z.string().max(100).optional(),
  baslangic_tarihi: z.string().optional(),
});

export const updateAtamaSchema = z.object({
  gorev: z.string().max(100).optional(),
  baslangic_tarihi: z.string().optional(),
  bitis_tarihi: z.string().optional().nullable(),
  notlar: z.string().max(1000).optional(),
  aktif: z.boolean().optional(),
});

// ─── Görev tanımlama ─────────────────────────────────────────

export const createGorevSchema = z.object({
  ad: z.string({ required_error: 'Görev adı gerekli' }).min(1, 'Görev adı gerekli').max(100),
  kod: z.string().max(50).optional(),
  aciklama: z.string().max(500).optional(),
  renk: z.string().max(20).optional().default('#6366f1'),
  ikon: z.string().max(50).optional().default('briefcase'),
  saat_ucreti: z.number().min(0).optional().default(0),
  gunluk_ucret: z.number().min(0).optional().default(0),
  sira: z.number().int().min(0).optional().default(0),
});

export const updateGorevSchema = z.object({
  ad: z.string().min(1).max(100).optional(),
  kod: z.string().max(50).optional(),
  aciklama: z.string().max(500).optional(),
  renk: z.string().max(20).optional(),
  ikon: z.string().max(50).optional(),
  saat_ucreti: z.number().min(0).optional(),
  gunluk_ucret: z.number().min(0).optional(),
  sira: z.number().int().min(0).optional(),
  aktif: z.boolean().optional(),
});

// ─── Tazminat hesaplama ──────────────────────────────────────

export const tazminatHesaplaSchema = z.object({
  personelId: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  cikisTarihi: z.string({ required_error: 'Çıkış tarihi gerekli' }),
  cikisSebebi: z.string({ required_error: 'Çıkış sebebi gerekli' }).min(1),
  kalanIzinGun: z.number().int().min(0).optional(),
});

export const tazminatKaydetSchema = z.object({
  personelId: z.number({ required_error: 'Personel ID gerekli' }).int().positive(),
  cikisTarihi: z.string({ required_error: 'Çıkış tarihi gerekli' }),
  cikisSebebi: z.string({ required_error: 'Çıkış sebebi gerekli' }).min(1),
  kalanIzinGun: z.number().int().min(0).optional(),
  notlar: z.string().max(2000).optional(),
  istenCikar: z.boolean().optional(),
});

// ─── İzin günü güncelleme ────────────────────────────────────

export const izinGunSchema = z.object({
  kalanIzinGun: z.number().int().min(0).max(365),
});
