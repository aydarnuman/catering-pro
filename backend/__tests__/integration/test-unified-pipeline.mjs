/**
 * UNIFIED PIPELINE TEST
 * Tek merkezi sistemi test eder
 */

import 'dotenv/config';
import { analyzeDocument, checkPipelineHealth } from '../../src/services/ai-analyzer/index.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           UNIFIED PIPELINE TEST v7.0                                 ║');
  console.log('║           Tek Merkezi Sistem                                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // 1. Health Check
  console.log('┌─ Pipeline Health Check ──────────────────────────────────────────────┐');
  const health = await checkPipelineHealth();
  console.log(`│  Azure Configured: ${health.azure.configured ? '✅' : '❌'}`);
  console.log(`│  Azure Healthy:    ${health.azure.healthy ? '✅' : '❌'}`);
  console.log(`│  Custom Model:     ${health.customModel.enabled ? '✅ ' + health.customModel.modelId : '❌ Disabled'}`);
  console.log(`│  Claude:           ${health.claude.configured ? '✅' : '❌'}`);
  console.log('└──────────────────────────────────────────────────────────────────────┘\n');

  // 2. Test dosyası bul
  const testFile = process.argv[2] || findTestPdf();
  
  if (!testFile) {
    console.log('❌ Test dosyası bulunamadı!');
    console.log('   Kullanım: node test-unified-pipeline.mjs <pdf-path>');
    process.exit(1);
  }

  console.log(`📄 Test dosyası: ${path.basename(testFile)}`);
  console.log(`   Boyut: ${Math.round(fs.statSync(testFile).size / 1024)} KB\n`);

  // 3. Analiz
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ANALİZ BAŞLIYOR                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  
  const result = await analyzeDocument(testFile, {
    onProgress: (p) => {
      console.log(`  ${p.message}`);
    },
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  // 4. Sonuç
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    SONUÇ                                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  if (result.success) {
    console.log(`✅ Analiz Başarılı (${duration}s)`);
    console.log(`   Provider: ${result.meta?.provider_used || 'unknown'}`);
    console.log(`   Completeness: ${result.validation?.completeness_score || 0}%`);
    
    console.log('\n📊 Çıkarılan Veriler:');
    
    const analysis = result.analysis || {};
    
    // Summary
    if (analysis.summary) {
      console.log('\n   📋 Özet:');
      if (analysis.summary.title) console.log(`      Başlık: ${analysis.summary.title.substring(0, 60)}...`);
      if (analysis.summary.institution) console.log(`      Kurum: ${analysis.summary.institution.substring(0, 50)}...`);
      if (analysis.summary.ikn) console.log(`      İKN: ${analysis.summary.ikn}`);
    }
    
    // Catering
    if (analysis.catering) {
      console.log('\n   🍽️  Catering:');
      if (analysis.catering.total_persons) console.log(`      Kişi sayısı: ${analysis.catering.total_persons}`);
      if (analysis.catering.daily_meals) console.log(`      Günlük öğün: ${analysis.catering.daily_meals}`);
      if (analysis.catering.sample_menus?.length) console.log(`      Menü tablosu: ${analysis.catering.sample_menus.length} adet`);
      if (analysis.catering.gramaj?.length) console.log(`      Gramaj: ${analysis.catering.gramaj.length} kalem`);
    }
    
    // Personnel
    if (analysis.personnel) {
      console.log('\n   👥 Personel:');
      if (analysis.personnel.total_count) console.log(`      Toplam: ${analysis.personnel.total_count}`);
      if (analysis.personnel.staff?.length) console.log(`      Pozisyon: ${analysis.personnel.staff.length} adet`);
    }
    
    // Dates
    if (analysis.dates) {
      console.log('\n   📅 Tarihler:');
      if (analysis.dates.start_date) console.log(`      Başlangıç: ${analysis.dates.start_date}`);
      if (analysis.dates.end_date) console.log(`      Bitiş: ${analysis.dates.end_date}`);
    }

  } else {
    console.log(`❌ Analiz Başarısız: ${result.error}`);
  }

  // JSON kaydet
  const outputPath = './test_unified_result.json';
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Tam sonuç: ${outputPath}`);
}

function findTestPdf() {
  const searchPaths = [
    '../../scripts/azure-training/documents/',
    '/Users/numanaydar/Desktop/ihale_dokumani_2026-91672/',
  ];
  
  for (const searchPath of searchPaths) {
    if (fs.existsSync(searchPath)) {
      const files = fs.readdirSync(searchPath).filter(f => f.endsWith('.pdf'));
      if (files.length > 0) {
        return path.join(searchPath, files[0]);
      }
    }
  }
  
  return null;
}

main().catch(console.error);
