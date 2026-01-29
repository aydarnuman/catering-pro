/**
 * Mevcut Uyumsoft faturalarından carileri import et
 * Tek seferlik çalıştırılacak script
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { query } from '../database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function importUyumsoftCariler() {
  try {
    // 1. Uyumsoft faturalarındaki benzersiz firmaları bul
    const firmalarResult = await query(`
      SELECT DISTINCT ON (sender_vkn) 
        sender_vkn as vergi_no,
        sender_name as unvan,
        sender_email as email,
        CASE 
          WHEN invoice_type LIKE '%incoming%' OR invoice_type LIKE '%Gelen%' THEN 'tedarikci'
          ELSE 'musteri'
        END as tip,
        SUM(payable_amount) FILTER (WHERE invoice_type LIKE '%incoming%' OR invoice_type LIKE '%Gelen%') OVER (PARTITION BY sender_vkn) as toplam_borc,
        SUM(payable_amount) FILTER (WHERE invoice_type NOT LIKE '%incoming%' AND invoice_type NOT LIKE '%Gelen%') OVER (PARTITION BY sender_vkn) as toplam_alacak
      FROM uyumsoft_invoices 
      WHERE sender_vkn IS NOT NULL 
        AND sender_name IS NOT NULL
      ORDER BY sender_vkn, created_at DESC
    `);

    if (firmalarResult.rows.length === 0) {
      return;
    }

    let _eklendiCount = 0;
    let _guncellendiCount = 0;
    let _hataCount = 0;

    // 2. Her firmayı cariler tablosuna ekle/güncelle
    for (const firma of firmalarResult.rows) {
      try {
        // Önce mevcut cari var mı kontrol et
        const mevcutCari = await query('SELECT id FROM cariler WHERE vergi_no = $1', [firma.vergi_no]);

        if (mevcutCari.rows.length > 0) {
          // Mevcut cari - bakiye güncelle
          await query(
            `
            UPDATE cariler 
            SET 
              borc = COALESCE(borc, 0) + $1,
              alacak = COALESCE(alacak, 0) + $2,
              updated_at = NOW()
            WHERE vergi_no = $3
          `,
            [firma.toplam_borc || 0, firma.toplam_alacak || 0, firma.vergi_no]
          );

          _guncellendiCount++;
        } else {
          // Yeni cari oluştur
          await query(
            `
            INSERT INTO cariler (
              tip, unvan, vergi_no, email,
              borc, alacak, aktif, notlar
            ) VALUES (
              $1, $2, $3, $4, $5, $6, true, $7
            )
          `,
            [
              firma.tip,
              firma.unvan,
              firma.vergi_no,
              firma.email,
              firma.toplam_borc || 0,
              firma.toplam_alacak || 0,
              'Uyumsoft faturalarından otomatik import edildi',
            ]
          );

          _eklendiCount++;
        }
      } catch (_error) {
        _hataCount++;
      }
    }

    // 4. Cari özet
    const cariOzet = await query(`
      SELECT 
        COUNT(*) as toplam,
        COUNT(*) FILTER (WHERE tip = 'musteri') as musteri_sayisi,
        COUNT(*) FILTER (WHERE tip = 'tedarikci') as tedarikci_sayisi,
        COUNT(*) FILTER (WHERE tip = 'her_ikisi') as her_ikisi_sayisi,
        SUM(borc) as toplam_borc,
        SUM(alacak) as toplam_alacak
      FROM cariler
      WHERE aktif = true
    `);

    const _ozet = cariOzet.rows[0];
    process.exit(0);
  } catch (_error) {
    process.exit(1);
  }
}

// Script'i çalıştır
importUyumsoftCariler();
