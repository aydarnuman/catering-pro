/**
 * Invoice (Fatura) Validation Schemas
 */

import { z } from 'zod';

const invoiceItemSchema = z.object({
  description: z.string().max(500).optional(),
  quantity: z.number().min(0, 'Miktar negatif olamaz').default(0),
  unit: z.string().max(20).optional(),
  unit_price: z.number().min(0, 'Birim fiyat negatif olamaz').default(0),
  vat_rate: z.number().min(0).max(100, 'KDV oranı 0-100 arası olmalı').default(18),
  discount_rate: z.number().min(0).max(100).optional().default(0),
});

const invoiceStatusEnum = z.enum(['draft', 'sent', 'paid', 'cancelled', 'overdue', 'pending', 'approved'], {
  errorMap: () => ({ message: 'Geçersiz fatura durumu' }),
});

export const createInvoiceSchema = z.object({
  invoice_type: z.enum(['sales', 'purchase', 'satis', 'alis'], {
    errorMap: () => ({ message: 'Fatura tipi sales, purchase, satis veya alis olmalı' }),
  }),
  series: z.string().max(10).optional(),
  invoice_no: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  customer_vkn: z.string().max(20).optional(),
  customer_address: z.string().max(500).optional(),
  customer_phone: z.string().max(30).optional(),
  customer_email: z.string().email('Geçersiz email').max(255).optional().or(z.literal('')),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  status: invoiceStatusEnum.optional().default('draft'),
  notes: z.string().max(2000).optional(),
  items: z.array(invoiceItemSchema).optional().default([]),
  created_by: z.number().int().positive().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema;

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusEnum,
});
