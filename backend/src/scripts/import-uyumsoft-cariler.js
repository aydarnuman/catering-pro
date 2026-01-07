/**
 * Mevcut Uyumsoft faturalarından carileri import et
 * Tek seferlik çalıştırılacak script
 */

import { query } from '../database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function importUyumsoftCariler() {
  try {
    console.log('🚀 Uyumsoft faturalarından cari import başlıyor...');
    
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
    
    console.log(`📊 ${firmalarResult.rows.length} benzersiz firma bulundu`);
    
    if (firmalarResult.rows.length === 0) {
      console.log('⚠️ Uyumsoft faturası bulunamadı');
      return;
    }
    
    let eklendiCount = 0;
    let guncellendiCount = 0;
    let hataCount = 0;
    
    // 2. Her firmayı cariler tablosuna ekle/güncelle
    for (const firma of firmalarResult.rows) {
      try {
        // Önce mevcut cari var mı kontrol et
        const mevcutCari = await query(
          'SELECT id FROM cariler WHERE vergi_no = $1',
          [firma.vergi_no]
        );
        
        if (mevcutCari.rows.length > 0) {
          // Mevcut cari - bakiye güncelle
          await query(`
            UPDATE cariler 
            SET 
              borc = COALESCE(borc, 0) + $1,
              alacak = COALESCE(alacak, 0) + $2,
              updated_at = NOW()
            WHERE vergi_no = $3
          `, [
            firma.toplam_borc || 0,
            firma.toplam_alacak || 0,
            firma.vergi_no
          ]);
          
          guncellendiCount++;
          console.log(`✅ Güncellendi: ${firma.unvan} (VKN: ${firma.vergi_no})`);
          
        } else {
          // Yeni cari oluştur
          await query(`
            INSERT INTO cariler (
              tip, unvan, vergi_no, email,
              borc, alacak, aktif, notlar
            ) VALUES (
              $1, $2, $3, $4, $5, $6, true, $7
            )
          `, [
            firma.tip,
            firma.unvan,
            firma.vergi_no,
            firma.email,
            firma.toplam_borc || 0,
            firma.toplam_alacak || 0,
            'Uyumsoft faturalarından otomatik import edildi'
          ]);
          
          eklendiCount++;
          console.log(`✅ Eklendi: ${firma.unvan} (VKN: ${firma.vergi_no})`);
        }
        
      } catch (error) {
        hataCount++;
        console.error(`❌ Hata: ${firma.unvan} - ${error.message}`);
      }
    }
    
    // 3. Özet rapor
    console.log('\n📊 İMPORT ÖZET:');
    console.log(`✅ Yeni eklenen: ${eklendiCount} cari`);
    console.log(`🔄 Güncellenen: ${guncellendiCount} cari`);
    console.log(`❌ Hatalı: ${hataCount} cari`);
    console.log(`📋 Toplam işlenen: ${firmalarResult.rows.length} firma`);
    
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
    
    const ozet = cariOzet.rows[0];
    console.log('\n💼 CARİ DURUMU:');
    console.log(`👥 Toplam Cari: ${ozet.toplam}`);
    console.log(`   - Müşteri: ${ozet.musteri_sayisi}`);
    console.log(`   - Tedarikçi: ${ozet.tedarikci_sayisi}`);
    console.log(`   - Her İkisi: ${ozet.her_ikisi_sayisi}`);
    console.log(`💰 Toplam Borç: ₺${Number(ozet.toplam_borc || 0).toLocaleString('tr-TR')}`);
    console.log(`💵 Toplam Alacak: ₺${Number(ozet.toplam_alacak || 0).toLocaleString('tr-TR')}`);
    console.log(`📊 Net Bakiye: ₺${Number((ozet.toplam_alacak || 0) - (ozet.toplam_borc || 0)).toLocaleString('tr-TR')}`);
    
    console.log('\n✨ Import işlemi tamamlandı!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Import hatası:', error);
    process.exit(1);
  }
}

// Script'i çalıştır
importUyumsoftCariler();
