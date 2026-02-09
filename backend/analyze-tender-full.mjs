/**
 * Full Tender Analysis Script
 * Tüm ihale dökümanlarını analiz eder ve birleştirir
 */

import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║           KAPSAMLI İHALE ANALİZİ                                     ║');
console.log('║           ihale_dokumani_2026-91672                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

// Load modules - v9.0: UNIFIED PIPELINE (hybrid-pipeline artık kullanılmıyor)
const { analyzeDocument } = await import('./src/services/ai-analyzer/unified-pipeline.js');

const TENDER_DIR = '/Users/numanaydar/Desktop/ihale_dokumani_2026-91672';

// Find all documents
const files = [];

function findFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findFiles(fullPath);
    } else if (item.endsWith('.pdf') || item.endsWith('.doc') || item.endsWith('.docx')) {
      files.push({
        path: fullPath,
        name: item,
        size: stat.size,
        type: path.extname(item).toLowerCase(),
      });
    }
  }
}

findFiles(TENDER_DIR);

console.log('📁 Bulunan Dökümanlar:');
files.forEach((f, i) => {
  console.log(`   ${i + 1}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
});
console.log('');

// Analyze each document
const results = [];
const startTime = Date.now();

for (const file of files) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📄 Analiz: ${file.name}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  const fileStart = Date.now();
  let result;
  
  try {
    // v9.0: Tüm dosya tipleri unified pipeline üzerinden
    result = await analyzeDocument(file.path, {
      onProgress: (p) => console.log(`   [${p.progress}%] ${p.message}`),
    });
    
    result.file = file.name;
    result.duration = Date.now() - fileStart;
    results.push(result);
    
    console.log(`   ✅ Tamamlandı (${(result.duration / 1000).toFixed(1)}s)`);
  } catch (error) {
    console.log(`   ❌ Hata: ${error.message}`);
    results.push({
      file: file.name,
      success: false,
      error: error.message,
    });
  }
  
  console.log('');
}

// Merge all results
console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                    BİRLEŞTİRİLMİŞ SONUÇLAR                           ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

const merged = {
  tender_info: {
    ikn: '2026/91672',
    title: '24 Aylık Malzeme Dahil Yemek Hizmeti Alımı',
    institution: '',
    tender_type: 'hizmet',
    duration: '24 ay',
  },
  dates: {
    all: [],
  },
  financial: {
    amounts: [],
    guarantees: {},
  },
  catering: {
    meals: [],
    gramaj: [],
    service_times: {},
    quality_requirements: [],
  },
  personnel: {
    staff: [],
    total_count: 0,
    qualifications: [],
    working_conditions: [],
  },
  penalties: [],
  technical_requirements: [],
  documents_analyzed: [],
};

// Merge data from all results
for (const result of results) {
  if (!result.success) continue;
  
  merged.documents_analyzed.push({
    file: result.file,
    success: result.success,
    duration: result.duration,
  });
  
  const analysis = result.analysis || {};
  
  // Institution
  if (analysis.summary?.institution && !merged.tender_info.institution) {
    merged.tender_info.institution = analysis.summary.institution;
  }
  
  // Dates
  if (analysis.dates?.all_dates?.length > 0) {
    merged.dates.all.push(...analysis.dates.all_dates.map(d => ({
      ...d,
      source: result.file,
    })));
  }
  
  // Financial
  if (analysis.financial?.all_amounts?.length > 0) {
    merged.financial.amounts.push(...analysis.financial.all_amounts.map(a => ({
      ...a,
      source: result.file,
    })));
  }
  if (analysis.financial?.estimated_cost?.amount) {
    merged.financial.estimated_cost = analysis.financial.estimated_cost;
  }
  if (analysis.financial?.guarantees) {
    Object.assign(merged.financial.guarantees, analysis.financial.guarantees);
  }
  
  // Meals
  if (analysis.catering?.meals?.length > 0) {
    for (const meal of analysis.catering.meals) {
      const existing = merged.catering.meals.find(m => m.type === meal.type);
      if (!existing) {
        merged.catering.meals.push({ ...meal, source: result.file });
      } else if (meal.quantity > existing.quantity) {
        Object.assign(existing, meal, { source: result.file });
      }
    }
  }
  
  // Gramaj
  if (analysis.catering?.gramaj?.length > 0) {
    const existingItems = new Set(merged.catering.gramaj.map(g => g.item?.toLowerCase()));
    for (const g of analysis.catering.gramaj) {
      if (!existingItems.has(g.item?.toLowerCase())) {
        merged.catering.gramaj.push({ ...g, source: result.file });
        existingItems.add(g.item?.toLowerCase());
      }
    }
  }
  
  // Quality requirements
  if (analysis.catering?.quality_requirements?.length > 0) {
    const existingReqs = new Set(merged.catering.quality_requirements.map(r => r.toLowerCase()));
    for (const req of analysis.catering.quality_requirements) {
      if (!existingReqs.has(req.toLowerCase())) {
        merged.catering.quality_requirements.push(req);
        existingReqs.add(req.toLowerCase());
      }
    }
  }
  
  // Personnel
  if (analysis.personnel?.staff?.length > 0) {
    const existingPositions = new Set(merged.personnel.staff.map(s => s.pozisyon?.toLowerCase()));
    for (const staff of analysis.personnel.staff) {
      if (!existingPositions.has(staff.pozisyon?.toLowerCase())) {
        merged.personnel.staff.push({ ...staff, source: result.file });
        existingPositions.add(staff.pozisyon?.toLowerCase());
      }
    }
  }
  if (analysis.personnel?.total_count > merged.personnel.total_count) {
    merged.personnel.total_count = analysis.personnel.total_count;
  }
  if (analysis.personnel?.qualifications?.length > 0) {
    const existingQuals = new Set(merged.personnel.qualifications);
    for (const q of analysis.personnel.qualifications) {
      if (!existingQuals.has(q)) {
        merged.personnel.qualifications.push(q);
        existingQuals.add(q);
      }
    }
  }
  
  // Penalties
  if (analysis.penalties?.length > 0) {
    merged.penalties.push(...analysis.penalties.map(p => ({
      ...p,
      source: result.file,
    })));
  }
  
  // Technical requirements
  if (analysis.technical_requirements?.length > 0) {
    const existingTech = new Set(merged.technical_requirements.map(t => t.toLowerCase()));
    for (const req of analysis.technical_requirements) {
      if (!existingTech.has(req.toLowerCase())) {
        merged.technical_requirements.push(req);
        existingTech.add(req.toLowerCase());
      }
    }
  }
}

// Display results
console.log('┌─ İHALE BİLGİLERİ ────────────────────────────────────────────────────┐');
console.log(`│  İKN: ${merged.tender_info.ikn}`.padEnd(72) + '│');
console.log(`│  Başlık: ${merged.tender_info.title}`.padEnd(72) + '│');
console.log(`│  Kurum: ${merged.tender_info.institution || 'Belirtilmemiş'}`.substring(0, 71).padEnd(72) + '│');
console.log(`│  Tür: ${merged.tender_info.tender_type} | Süre: ${merged.tender_info.duration}`.padEnd(72) + '│');
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ ÖĞÜN BİLGİLERİ ─────────────────────────────────────────────────────┐');
for (const meal of merged.catering.meals) {
  const qty = meal.quantity?.toLocaleString('tr-TR') || 'N/A';
  console.log(`│  🍽️  ${meal.type}: ${qty} ${meal.unit || 'öğün'}`.padEnd(72) + '│');
}
if (merged.catering.meals.length === 0) {
  console.log('│  (Öğün bilgisi bulunamadı)'.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ PERSONEL ──────────────────────────────────────────────────────────┐');
console.log(`│  Toplam: ${merged.personnel.total_count} kişi`.padEnd(72) + '│');
console.log('│'.padEnd(72) + '│');
for (const staff of merged.personnel.staff.slice(0, 15)) {
  console.log(`│  👤 ${staff.pozisyon}: ${staff.adet} kişi`.substring(0, 71).padEnd(72) + '│');
}
if (merged.personnel.staff.length > 15) {
  console.log(`│  ... ve ${merged.personnel.staff.length - 15} pozisyon daha`.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ GRAMAJ BİLGİLERİ ───────────────────────────────────────────────────┐');
if (merged.catering.gramaj.length > 0) {
  for (const g of merged.catering.gramaj.slice(0, 20)) {
    console.log(`│  ⚖️  ${g.item}: ${g.weight}${g.unit || 'g'}`.substring(0, 71).padEnd(72) + '│');
  }
  if (merged.catering.gramaj.length > 20) {
    console.log(`│  ... ve ${merged.catering.gramaj.length - 20} malzeme daha`.padEnd(72) + '│');
  }
} else {
  console.log('│  (Gramaj bilgisi bulunamadı - bu teknik şartnamede gramaj tablosu yok)'.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ TARİHLER ──────────────────────────────────────────────────────────┐');
if (merged.dates.all.length > 0) {
  for (const d of merged.dates.all.slice(0, 10)) {
    console.log(`│  📅 ${d.date}: ${d.type || d.description || 'N/A'}`.substring(0, 71).padEnd(72) + '│');
  }
} else {
  console.log('│  (Tarih bilgisi idari şartnameden alınmalı)'.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ MALİ BİLGİLER ─────────────────────────────────────────────────────┐');
if (merged.financial.estimated_cost?.amount) {
  console.log(`│  💰 Yaklaşık Maliyet: ${merged.financial.estimated_cost.amount}`.padEnd(72) + '│');
}
if (merged.financial.guarantees.gecici) {
  console.log(`│  🔒 Geçici Teminat: ${merged.financial.guarantees.gecici}`.padEnd(72) + '│');
}
if (merged.financial.guarantees.kesin) {
  console.log(`│  🔒 Kesin Teminat: ${merged.financial.guarantees.kesin}`.padEnd(72) + '│');
}
if (merged.financial.amounts.length > 0) {
  console.log('│'.padEnd(72) + '│');
  for (const a of merged.financial.amounts.slice(0, 5)) {
    const val = a.value?.toLocaleString?.('tr-TR') || a.value;
    console.log(`│  ${val} ${a.currency || 'TL'} - ${a.type || 'N/A'}`.substring(0, 71).padEnd(72) + '│');
  }
} else if (!merged.financial.estimated_cost?.amount) {
  console.log('│  (Mali bilgi bulunamadı - idari şartnameden alınmalı)'.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ CEZA KOŞULLARI ────────────────────────────────────────────────────┐');
if (merged.penalties.length > 0) {
  for (const p of merged.penalties.slice(0, 10)) {
    console.log(`│  ⚠️  ${p.description?.substring(0, 60) || 'N/A'}`.padEnd(72) + '│');
  }
} else {
  console.log('│  (Ceza koşulları sözleşme tasarısında detaylı olabilir)'.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ TEKNİK GEREKSİNİMLER ──────────────────────────────────────────────┐');
for (const req of merged.technical_requirements.slice(0, 10)) {
  console.log(`│  📋 ${req.substring(0, 65)}`.padEnd(72) + '│');
}
if (merged.technical_requirements.length > 10) {
  console.log(`│  ... ve ${merged.technical_requirements.length - 10} gereksinim daha`.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

console.log('┌─ KALİTE GEREKSİNİMLERİ ─────────────────────────────────────────────┐');
for (const req of merged.catering.quality_requirements.slice(0, 5)) {
  console.log(`│  ✅ ${req.substring(0, 65)}`.padEnd(72) + '│');
}
console.log('└─────────────────────────────────────────────────────────────────────┘');
console.log('');

// Summary
const totalDuration = (Date.now() - startTime) / 1000;
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                         ÖZET                                         ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`   📁 Analiz edilen döküman: ${results.length}`);
console.log(`   ⏱️  Toplam süre: ${totalDuration.toFixed(1)}s`);
console.log('');
console.log('   Çıkarılan Veri:');
console.log(`   • Öğün türleri: ${merged.catering.meals.length}`);
console.log(`   • Personel pozisyonları: ${merged.personnel.staff.length} (${merged.personnel.total_count} kişi)`);
console.log(`   • Gramaj kayıtları: ${merged.catering.gramaj.length}`);
console.log(`   • Tarihler: ${merged.dates.all.length}`);
console.log(`   • Mali veriler: ${merged.financial.amounts.length}`);
console.log(`   • Ceza koşulları: ${merged.penalties.length}`);
console.log(`   • Teknik gereksinimler: ${merged.technical_requirements.length}`);
console.log(`   • Kalite gereksinimleri: ${merged.catering.quality_requirements.length}`);
console.log('');

// Save full result
const outputPath = '/tmp/tender_2026-91672_full_analysis.json';
fs.writeFileSync(outputPath, JSON.stringify({
  merged,
  individual_results: results,
  meta: {
    total_duration: totalDuration,
    analyzed_at: new Date().toISOString(),
  },
}, null, 2));

console.log(`📁 Tam sonuç: ${outputPath}`);
console.log('');
