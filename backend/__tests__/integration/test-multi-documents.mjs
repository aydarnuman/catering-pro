#!/usr/bin/env node
/**
 * Multi-Document Test for Unified Pipeline v8.0
 * Azure Custom Model + Claude ile çoklu döküman testi
 */

import fs from 'fs';
import path from 'path';
import { analyzeDocument, checkPipelineHealth } from '../../src/services/ai-analyzer/unified-pipeline.js';

const TEST_DOCUMENTS = [
  '../../scripts/azure-training/documents/tender_282_teknik.pdf',
  '../../scripts/azure-training/documents/tender_296_teknik.pdf',
  '../../scripts/azure-training/documents/tender_2_teknik.pdf',
  '../../scripts/azure-training/documents/1768656539613-7e1e92b8-Yemek_Teknik_Sartname.pdf.pdf',
  '../../scripts/azure-training/documents/1768658336433-741f9e03-CEVIK_KUVVET_IASE_TEKNIK_SARTNAME.pdf.pdf',
];

async function testDocument(filePath, index, total) {
  const fileName = path.basename(filePath);
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📄 [${index + 1}/${total}] ${fileName}`);
  console.log('─'.repeat(70));

  try {
    const stats = fs.statSync(filePath);
    console.log(`   Boyut: ${Math.round(stats.size / 1024)} KB`);

    const startTime = Date.now();
    const result = await analyzeDocument(filePath, {
      onProgress: (p) => {
        process.stdout.write(`\r   ${p.message.padEnd(50)}`);
      },
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n');

    if (result.success) {
      const analysis = result.analysis || {};
      const validation = result.validation || {};
      
      console.log(`   ✅ Başarılı (${elapsed}s)`);
      console.log(`   Provider: ${result.meta?.provider_used || 'unknown'}`);
      console.log(`   Completeness: ${validation.completeness_score || 0}%`);
      console.log('');
      console.log(`   📋 Özet:`);
      console.log(`      Başlık: ${truncate(analysis.summary?.title, 50)}`);
      console.log(`      Kurum: ${truncate(analysis.summary?.institution, 50)}`);
      console.log(`      IKN: ${analysis.summary?.ikn || '-'}`);
      console.log('');
      console.log(`   🍽️  Catering:`);
      console.log(`      Kişi: ${analysis.catering?.total_persons || '-'}`);
      console.log(`      Öğün: ${analysis.catering?.daily_meals || '-'}`);
      console.log(`      Gramaj: ${analysis.catering?.gramaj?.length || 0} kalem`);
      console.log('');
      console.log(`   📅 Tarihler:`);
      console.log(`      Başlangıç: ${analysis.dates?.start_date || '-'}`);
      console.log(`      Bitiş: ${analysis.dates?.end_date || '-'}`);

      return {
        file: fileName,
        success: true,
        provider: result.meta?.provider_used,
        completeness: validation.completeness_score || 0,
        elapsed,
        summary: analysis.summary,
        catering: {
          persons: analysis.catering?.total_persons,
          meals: analysis.catering?.daily_meals,
          gramaj_count: analysis.catering?.gramaj?.length || 0,
        },
        dates: analysis.dates,
      };
    } else {
      console.log(`   ❌ Başarısız: ${result.error}`);
      return { file: fileName, success: false, error: result.error };
    }
  } catch (err) {
    console.log(`   ❌ Hata: ${err.message}`);
    return { file: fileName, success: false, error: err.message };
  }
}

function truncate(str, len) {
  if (!str) return '-';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           MULTI-DOCUMENT TEST - UNIFIED PIPELINE v8.0                ║');
  console.log('║           Azure Custom Model + Claude                                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Health check
  console.log('\n┌─ Pipeline Health Check ──────────────────────────────────────────────┐');
  const health = await checkPipelineHealth();
  console.log(`│  Azure Configured: ${health.azure.configured ? '✅' : '❌'}`);
  console.log(`│  Azure Healthy:    ${health.azure.healthy ? '✅' : '❌'}`);
  console.log(`│  Custom Model:     ${health.customModel.enabled ? '✅ ' + health.customModel.modelId : '❌ Disabled'}`);
  console.log(`│  Claude:           ${health.claude.configured ? '✅' : '❌'}`);
  console.log('└──────────────────────────────────────────────────────────────────────┘');

  // Filter existing files
  const existingFiles = TEST_DOCUMENTS.filter(f => fs.existsSync(f));
  console.log(`\n📁 Test edilecek döküman sayısı: ${existingFiles.length}`);

  if (existingFiles.length === 0) {
    console.log('❌ Test edilecek döküman bulunamadı!');
    return;
  }

  // Test each document
  const results = [];
  for (let i = 0; i < existingFiles.length; i++) {
    const result = await testDocument(existingFiles[i], i, existingFiles.length);
    results.push(result);
  }

  // Summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                         ÖZET RAPOR                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgCompleteness = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + (r.completeness || 0), 0) / successful.length)
    : 0;

  console.log(`\n   Başarılı: ${successful.length}/${results.length}`);
  console.log(`   Başarısız: ${failed.length}/${results.length}`);
  console.log(`   Ortalama Completeness: ${avgCompleteness}%`);

  console.log('\n   📊 Detay:\n');
  console.log('   ' + '─'.repeat(80));
  console.log('   ' + 'Dosya'.padEnd(40) + 'Provider'.padEnd(20) + 'Completeness'.padEnd(15) + 'Süre');
  console.log('   ' + '─'.repeat(80));

  for (const r of results) {
    if (r.success) {
      console.log(
        '   ' +
          truncate(r.file, 38).padEnd(40) +
          (r.provider || '-').padEnd(20) +
          `${r.completeness}%`.padEnd(15) +
          `${r.elapsed}s`
      );
    } else {
      console.log('   ' + truncate(r.file, 38).padEnd(40) + '❌ ' + truncate(r.error, 40));
    }
  }
  console.log('   ' + '─'.repeat(80));

  // Save results
  fs.writeFileSync('./test_multi_results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Sonuçlar: ./test_multi_results.json');
}

main().catch(console.error);
