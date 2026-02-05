/**
 * Zero-Loss Pipeline v8.0 Test
 * ============================
 * Layer 6.5: Fill Missing Critical Fields dahil
 * 
 * Test edilen özellikler:
 * - 8 katmanlı pipeline
 * - Kritik alan validasyonu (iletisim, teminat, servis_saatleri, tahmini_bedel)
 * - Eksik alan doldurma (fillMissingFields)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load env
config({ path: './.env' });

// Unified Pipeline import
const { analyzeDocument, checkPipelineHealth } = await import('./src/services/ai-analyzer/unified-pipeline.js');

// Field validator import (yeni)
const { validateCriticalFields, CRITICAL_FIELDS } = await import('./src/services/ai-analyzer/controls/field-validator.js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// CLI args
const args = process.argv.slice(2);
const docId = args[0] ? parseInt(args[0]) : 327; // Default: Teknik Şartname

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       ZERO-LOSS PIPELINE v8.0 TEST                            ║');
  console.log('║       Layer 6.5: Fill Missing Critical Fields                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Health check
  console.log('🔧 Pipeline Health Check...');
  const health = await checkPipelineHealth();
  console.log(`   Azure: ${health.azure.configured ? '✅' : '❌'} (healthy: ${health.azure.healthy ? '✅' : '❌'})`);
  console.log(`   Custom Model: ${health.customModel.enabled ? '✅ ' + health.customModel.modelId : '❌'}`);
  console.log(`   Claude: ${health.claude.configured ? '✅' : '❌'}`);
  
  // Kritik alanları göster
  console.log('\n📋 Kritik Alanlar (Layer 6.5 kontrol eder):');
  Object.entries(CRITICAL_FIELDS).forEach(([field, config]) => {
    const reqStr = Array.isArray(config.required) 
      ? `[${config.required.join(', ')}]` 
      : config.required;
    console.log(`   - ${field}: required=${reqStr}`);
  });
  
  console.log(`\n🔍 Döküman #${docId} aranıyor...\n`);
  
  // Dökümanı bul
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, original_filename, storage_url, file_type, tender_id, processing_status, doc_type')
    .eq('id', docId)
    .limit(1);
  
  if (error) {
    console.error('DB Error:', error.message);
    return;
  }
  
  if (!docs || docs.length === 0) {
    console.log(`Döküman #${docId} bulunamadı`);
    return;
  }
  
  const doc = docs[0];
  console.log(`📄 Döküman Bilgileri:`);
  console.log(`   ID: ${doc.id}`);
  console.log(`   Dosya: ${doc.original_filename}`);
  console.log(`   Tip: ${doc.doc_type || 'unknown'}`);
  console.log(`   Status: ${doc.processing_status}`);
  console.log(`   URL: ${doc.storage_url?.substring(0, 60)}...`);
  
  if (!doc.storage_url) {
    console.error('\n❌ storage_url yok, dosya indirilemez');
    return;
  }
  
  // PDF'i indir
  console.log('\n📥 Dosya indiriliyor...');
  const response = await fetch(doc.storage_url);
  if (!response.ok) {
    console.error('Download failed:', response.status, response.statusText);
    return;
  }
  
  const fileBuffer = Buffer.from(await response.arrayBuffer());
  const ext = path.extname(doc.original_filename) || '.pdf';
  const tempPath = `/tmp/test_doc_${docId}_${Date.now()}${ext}`;
  fs.writeFileSync(tempPath, fileBuffer);
  console.log(`   Kaydedildi: ${tempPath} (${(fileBuffer.length / 1024).toFixed(1)} KB)`);
  
  // ZERO-LOSS PIPELINE çalıştır
  console.log('\n' + '═'.repeat(65));
  console.log('🚀 ZERO-LOSS PIPELINE v8.0 BAŞLIYOR...');
  console.log('═'.repeat(65) + '\n');
  
  const startTime = Date.now();
  const progressLog = [];
  
  try {
    const result = await analyzeDocument(tempPath, {
      onProgress: (progress) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const msg = `[${elapsed}s] ${progress.stage}: ${progress.message} (${progress.progress || 0}%)`;
        console.log(msg);
        progressLog.push({ ...progress, elapsed });
      }
    });
    
    console.log('\n' + '═'.repeat(65));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log(`\n✅ BAŞARILI! (${duration}s)\n`);
      
      // Meta bilgiler
      console.log('📊 Pipeline Meta:');
      console.log(`   Provider: ${result.meta?.provider_used || 'unknown'}`);
      console.log(`   Version: ${result.meta?.unified_pipeline_version || result.meta?.pipeline_version || '-'}`);
      console.log(`   Chunks: ${result.meta?.chunk_count || '-'}`);
      
      const analysis = result.analysis || result;
      
      // ═══════════════════════════════════════════════════════════════
      // KRİTİK ALAN VALİDASYONU (Layer 6.5 sonrası)
      // ═══════════════════════════════════════════════════════════════
      console.log('\n' + '─'.repeat(65));
      console.log('🎯 KRİTİK ALAN VALİDASYONU (Layer 6.5):');
      console.log('─'.repeat(65));
      
      const criticalValidation = validateCriticalFields(analysis);
      
      console.log(`   Geçerli: ${criticalValidation.valid ? '✅ EVET' : '❌ HAYIR'}`);
      console.log(`   Tamamlanma: ${(criticalValidation.completeness * 100).toFixed(1)}%`);
      
      console.log('\n   Dolu Alanlar:');
      if (criticalValidation.filled.length > 0) {
        criticalValidation.filled.forEach(f => {
          // f string veya object olabilir
          const fieldName = typeof f === 'string' ? f : f.field;
          console.log(`      ✅ ${fieldName}`);
        });
      } else {
        console.log('      (yok)');
      }
      
      console.log('\n   Eksik Alanlar:');
      if (criticalValidation.missing.length > 0) {
        criticalValidation.missing.forEach(m => {
          console.log(`      ❌ ${m.field}: ${m.reason}`);
        });
      } else {
        console.log('      (yok - tüm kritik alanlar dolu!)');
      }
      
      // ═══════════════════════════════════════════════════════════════
      // ALAN DETAYLARI
      // ═══════════════════════════════════════════════════════════════
      console.log('\n' + '─'.repeat(65));
      console.log('📋 ALAN DETAYLARI:');
      console.log('─'.repeat(65));
      
      // iletisim
      console.log('\n📞 İletişim:');
      const iletisim = analysis.iletisim || {};
      console.log(`   Adres: ${iletisim.adres || '-'}`);
      console.log(`   Telefon: ${iletisim.telefon || '-'}`);
      console.log(`   Email: ${iletisim.email || '-'}`);
      console.log(`   Yetkili: ${iletisim.yetkili_kisi || '-'}`);
      
      // teminat_oranlari
      console.log('\n💰 Teminat Oranları:');
      const teminat = analysis.teminat_oranlari || {};
      console.log(`   Geçici: ${teminat.gecici_teminat || '-'}`);
      console.log(`   Kesin: ${teminat.kesin_teminat || '-'}`);
      
      // servis_saatleri
      console.log('\n⏰ Servis Saatleri:');
      const servis = analysis.servis_saatleri || {};
      console.log(`   Kahvaltı: ${servis.kahvalti || '-'}`);
      console.log(`   Öğle: ${servis.ogle || '-'}`);
      console.log(`   Akşam: ${servis.aksam || '-'}`);
      
      // tahmini_bedel
      console.log('\n💵 Tahmini Bedel:');
      console.log(`   ${analysis.tahmini_bedel || analysis.yaklasik_maliyet || '-'}`);
      
      // mali_kriterler
      console.log('\n📈 Mali Kriterler:');
      const mali = analysis.mali_kriterler || {};
      console.log(`   Ciro: ${mali.ciro || '-'}`);
      console.log(`   Banka Referansı: ${mali.banka_referansi || '-'}`);
      
      // ═══════════════════════════════════════════════════════════════
      // GENEL ÖZET
      // ═══════════════════════════════════════════════════════════════
      console.log('\n' + '─'.repeat(65));
      console.log('📝 GENEL ÖZET:');
      console.log('─'.repeat(65));
      
      console.log(`   İhale Konusu: ${analysis.ihale_konusu || analysis.summary?.title || '-'}`);
      console.log(`   Kurum: ${analysis.idare_adi || analysis.summary?.institution || '-'}`);
      console.log(`   IKN: ${analysis.ihale_kayit_no || analysis.summary?.ikn || '-'}`);
      console.log(`   Süre: ${analysis.sure || '-'}`);
      
      // Kişi/Öğün
      console.log('\n   Servis Detayları:');
      console.log(`      Kişi Sayısı: ${analysis.kisi_sayisi || '-'}`);
      console.log(`      Öğün Sayısı: ${analysis.ogun_sayisi || '-'}`);
      
      // Tarihler
      console.log('\n   Tarihler:');
      console.log(`      Başlangıç: ${analysis.ise_baslama_tarihi || '-'}`);
      console.log(`      Bitiş: ${analysis.is_bitis_tarihi || '-'}`);
      
      // Pipeline validation (eğer varsa)
      if (result.validation) {
        console.log('\n' + '─'.repeat(65));
        console.log('✅ PIPELINE VALIDATION:');
        console.log('─'.repeat(65));
        console.log(`   Completeness Score: ${result.validation.completeness_score || 0}%`);
        
        if (result.validation.completeness_details?.missing?.length > 0) {
          console.log('   Missing Fields:');
          result.validation.completeness_details.missing.slice(0, 10).forEach(m => {
            console.log(`      - ${m}`);
          });
        }
      }
      
      // Kritik Alan Durumu (Unified Pipeline Layer 6.5)
      if (result.critical_fields) {
        console.log('\n' + '─'.repeat(65));
        console.log('🎯 UNIFIED PIPELINE - KRİTİK ALAN SONUCU:');
        console.log('─'.repeat(65));
        
        if (result.critical_fields.all_filled) {
          console.log('   ✅ Tüm kritik alanlar DOLU');
          console.log(`   Completeness: ${(result.critical_fields.validation?.completeness * 100 || 0).toFixed(1)}%`);
        } else {
          const before = result.critical_fields.before;
          const after = result.critical_fields.after;
          console.log(`   Önce: ${(before?.completeness * 100 || 0).toFixed(1)}% tamamlandı`);
          console.log(`   Sonra: ${(after?.completeness * 100 || 0).toFixed(1)}% tamamlandı`);
          console.log(`   Doldurulan: ${result.critical_fields.filled_count || 0} alan`);
          
          if (after?.filled?.length > 0) {
            console.log('   Dolduruldu:');
            after.filled.forEach(f => {
              const fieldName = typeof f === 'string' ? f : f.field;
              console.log(`      ✅ ${fieldName}`);
            });
          }
          
          if (after?.missing?.length > 0) {
            console.log('   Hala Eksik (normal - bu döküman tipinde olmayabilir):');
            after.missing.forEach(m => {
              console.log(`      ⚠️ ${m.field}`);
            });
          }
        }
      }
      
      // Sonucu kaydet
      const outputPath = `/tmp/zero_loss_test_${docId}_${Date.now()}.json`;
      fs.writeFileSync(outputPath, JSON.stringify({
        document: { id: doc.id, filename: doc.original_filename, doc_type: doc.doc_type },
        pipeline_result: result,
        critical_validation: criticalValidation,
        progress_log: progressLog,
        duration_seconds: parseFloat(duration)
      }, null, 2));
      console.log(`\n📁 Tam sonuç: ${outputPath}`);
      
      // DB'ye kaydet
      console.log('\n💾 Veritabanına kaydediliyor...');
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          analysis_result: {
            pipeline_version: '8.0-zero-loss',
            ...analysis,
            _meta: {
              ...result.meta,
              critical_validation: criticalValidation,
              test_run: true,
              tested_at: new Date().toISOString()
            }
          },
          processing_status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', docId);
      
      if (updateError) {
        console.error(`   ❌ Kayıt hatası: ${updateError.message}`);
      } else {
        console.log(`   ✅ Döküman #${docId} güncellendi`);
      }
      
    } else {
      console.log(`\n❌ BAŞARISIZ: ${result.error}`);
      if (result.details) {
        console.log('   Detay:', result.details);
      }
    }
    
  } catch (err) {
    console.error('\n❌ Pipeline hatası:', err.message);
    console.error(err.stack);
  } finally {
    // Temp dosyayı temizle
    try {
      fs.unlinkSync(tempPath);
      console.log(`\n🧹 Temp dosya silindi`);
    } catch {}
  }
  
  console.log('\n' + '═'.repeat(65));
  console.log('TEST TAMAMLANDI');
  console.log('═'.repeat(65));
}

main().catch(console.error);
