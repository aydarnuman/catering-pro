/**
 * Gerçek pipeline testi - Teknik Şartname PDF analizi
 * UNIFIED PIPELINE v8.0 kullanır
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { analyzeDocument, checkPipelineHealth } from '../../src/services/ai-analyzer/unified-pipeline.js';

// Load env
config({ path: '../../.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  // Health check
  console.log('🔧 Pipeline Health Check...');
  const health = await checkPipelineHealth();
  console.log(`   Azure: ${health.azure.configured ? '✅' : '❌'} (healthy: ${health.azure.healthy ? '✅' : '❌'})`);
  console.log(`   Custom Model: ${health.customModel.enabled ? '✅ ' + health.customModel.modelId : '❌'}`);
  console.log(`   Claude: ${health.claude.configured ? '✅' : '❌'}`);
  
  console.log('\n🔍 Teknik Şartname dökümanı aranıyor...\n');
  
  // Teknik şartname dökümanını bul (ID: 327)
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, original_filename, storage_url, file_type, tender_id, processing_status')
    .eq('id', 327)
    .limit(1);
  
  if (error) {
    console.error('DB Error:', error.message);
    return;
  }
  
  if (!docs || docs.length === 0) {
    console.log('Teknik şartname bulunamadı');
    return;
  }
  
  console.log('Bulunan dökümanlar:');
  docs.forEach((d, i) => {
    console.log(`${i + 1}. [ID: ${d.id}] ${d.original_filename} (status: ${d.processing_status})`);
  });
  
  // İlk dökümanı seç
  const doc = docs[0];
  console.log(`\n📄 Seçilen: ${doc.original_filename}`);
  console.log(`   ID: ${doc.id}`);
  console.log(`   URL: ${doc.storage_url?.substring(0, 80)}...`);
  
  // PDF'i indir
  console.log('\n📥 PDF indiriliyor...');
  const response = await fetch(doc.storage_url);
  if (!response.ok) {
    console.error('Download failed:', response.status);
    return;
  }
  
  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  const tempPath = `/tmp/test_teknik_sartname_${Date.now()}.pdf`;
  fs.writeFileSync(tempPath, pdfBuffer);
  console.log(`   Kaydedildi: ${tempPath} (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  
  // UNIFIED PIPELINE çalıştır
  console.log('\n🚀 UNIFIED PIPELINE v8.0 başlatılıyor...\n');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    const result = await analyzeDocument(tempPath, {
      onProgress: (progress) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${elapsed}s] ${progress.stage}: ${progress.message} (${progress.progress || 0}%)`);
      }
    });
    
    console.log('=' .repeat(60));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (result.success) {
      console.log(`\n✅ BAŞARILI! (${duration}s)`);
      console.log(`\n📊 Meta Bilgiler:`);
      console.log(`   - Provider: ${result.meta?.provider_used || 'unknown'}`);
      console.log(`   - Pipeline Version: ${result.meta?.unified_pipeline_version || result.meta?.pipeline_version}`);
      console.log(`   - Completeness: ${result.validation?.completeness_score || 0}%`);
      
      const analysis = result.analysis || {};
      
      console.log('\n📋 Özet:');
      console.log(`   Başlık: ${analysis.summary?.title || '-'}`);
      console.log(`   Kurum: ${analysis.summary?.institution || '-'}`);
      console.log(`   IKN: ${analysis.summary?.ikn || '-'}`);
      console.log(`   Tahmini Bedel: ${analysis.summary?.estimated_value || '-'}`);
      
      console.log('\n🍽️  Catering:');
      console.log(`   Kişi Sayısı: ${analysis.catering?.total_persons || '-'}`);
      console.log(`   Günlük Öğün: ${analysis.catering?.daily_meals || '-'}`);
      console.log(`   Sözleşme Süresi: ${analysis.catering?.contract_duration || '-'}`);
      console.log(`   Menü Sayısı: ${analysis.catering?.sample_menus?.length || 0}`);
      console.log(`   Gramaj Kalem: ${analysis.catering?.gramaj?.length || 0}`);
      
      // Gramaj detayları
      if (analysis.catering?.gramaj?.length > 0) {
        console.log('\n   📏 Gramaj (ilk 10):');
        analysis.catering.gramaj.slice(0, 10).forEach((g, i) => {
          console.log(`      ${i + 1}. ${g.item}: ${g.weight}${g.unit || 'g'}`);
        });
      }
      
      console.log('\n👥 Personel:');
      console.log(`   Toplam: ${analysis.personnel?.total_count || '-'}`);
      if (analysis.personnel?.staff?.length > 0) {
        console.log('   Detay:');
        analysis.personnel.staff.slice(0, 10).forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.pozisyon}: ${p.adet} kişi`);
        });
      }
      
      console.log('\n📅 Tarihler:');
      console.log(`   Başlangıç: ${analysis.dates?.start_date || '-'}`);
      console.log(`   Bitiş: ${analysis.dates?.end_date || '-'}`);
      console.log(`   İhale Tarihi: ${analysis.dates?.tender_date || '-'}`);
      
      // Completeness details
      if (result.validation?.completeness_details?.missing?.length > 0) {
        console.log('\n⚠️  Eksik Alanlar:');
        result.validation.completeness_details.missing.forEach(m => {
          console.log(`   - ${m}`);
        });
      }
      
      // Tam analiz sonucunu dosyaya kaydet
      const outputPath = '/tmp/unified_analysis_result.json';
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log(`\n📁 Tam analiz sonucu kaydedildi: ${outputPath}`);
      
    } else {
      console.log(`\n❌ BAŞARISIZ: ${result.error}`);
    }
    
  } catch (err) {
    console.error('\n❌ Pipeline hatası:', err.message);
    console.error(err.stack);
  } finally {
    // Temp dosyayı temizle
    try {
      fs.unlinkSync(tempPath);
      console.log(`\n🧹 Temp dosya silindi: ${tempPath}`);
    } catch {}
  }
}

main().catch(console.error);
