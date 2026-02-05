/**
 * SMART LABEL v4 - Multi-Step Pipeline
 * 
 * 4 Aşamalı Akıllı Etiketleme:
 * 1. Doküman Yapı Analizi
 * 2. Tablo Sınıflandırma (tek tek)
 * 3. String Alan Çıkarma (sayfa sayfa)
 * 4. Çapraz Doğrulama
 */

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import Anthropic from '@anthropic-ai/sdk';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  azure: {
    endpoint: 'https://catering-doc-ai-123.cognitiveservices.azure.com/',
    key: '5I9qhCxX15RUpdgFccCwjUIUaffI4sIeZbSBFoYet0uIkOf8bPRCJQQJ99CBAC5RqLJXJ3w3AAALACOGt8H3',
  },
  storage: {
    account: 'cateringtr',
    key: 'c1iGE5YMj27VzJpZt4Kj9cRprzIB5j0h1VefqBXt312zcpUW+FC4Bpb/WvQdWfHevFoEoWZgxUmp+ASt+ipGOw==',
    container: 'ihale-training',
  },
  anthropic: {
    key: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TABLO TİPLERİ
// ═══════════════════════════════════════════════════════════════════════════

const TABLE_TYPES = [
  'haftalik_menu_1',    // 1. Hafta Menüsü
  'haftalik_menu_2',    // 2. Hafta Menüsü
  'haftalik_menu_3',    // 3. Hafta Menüsü
  'haftalik_menu_4',    // 4. Hafta Menüsü
  'ornek_menu',         // Genel menü tablosu
  'gramaj_tablosu',     // Gramaj/porsiyon/çiğ girdi
  'yemek_gruplari',     // Çorba, Ana Yemek grupları
  'ogun_dagilimi',      // Kahvaltı/Öğle/Akşam dağılımı
  'personel_tablosu',   // İşçi/personel listesi
  'birim_fiyat_cetveli',// Fiyat teklif cetveli
  'fiyat_tablosu',      // Genel fiyat tablosu
  'malzeme_listesi',    // Hammadde listesi
  'ekipman_listesi',    // Mutfak ekipmanları
  'dagitim_noktalari',  // Yemekhaneler/servis noktaları
  'ceza_kesintileri',   // Ceza tablosu
  'kalite_standartlari',// Kalite gereksinimleri
  'diger',              // Sınıflandırılamayan
];

// ═══════════════════════════════════════════════════════════════════════════
// STRING ALANLAR
// ═══════════════════════════════════════════════════════════════════════════

const STRING_FIELDS = {
  critical: [
    'ihale_konusu',
    'ihale_kayit_no',
    'idare_adi',
    'gunluk_kisi_sayisi',
    'isci_sayisi',
    'ogun_sayisi',
    'sozlesme_suresi',
    'hizmet_gun_sayisi',
    'iscilik_orani',
  ],
  important: [
    'toplam_kisi_sayisi',
    'yemek_cesit_sayisi',
    'ise_baslama_tarihi',
    'is_bitis_tarihi',
    'yaklasik_maliyet',
    'ogun_basi_fiyat',
    'mutfak_tipi',
    'servis_tipi',
    'servis_saati',
    'teslim_yeri',
    'et_tipi',
  ],
  boolean: [
    'kahvalti_var',
    'ara_ogun_var',
    'gece_yemegi_var',
    'diyet_menu_var',
    'ekmek_dahil',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// AZURE CLIENTS
// ═══════════════════════════════════════════════════════════════════════════

const docClient = new DocumentAnalysisClient(CONFIG.azure.endpoint, new AzureKeyCredential(CONFIG.azure.key));
const sharedKeyCredential = new StorageSharedKeyCredential(CONFIG.storage.account, CONFIG.storage.key);
const blobService = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${CONFIG.storage.account};AccountKey=${CONFIG.storage.key};EndpointSuffix=core.windows.net`
);
const containerClient = blobService.getContainerClient(CONFIG.storage.container);
const anthropic = new Anthropic({ apiKey: CONFIG.anthropic.key });

function getBlobSasUrl(blobName) {
  const sasToken = generateBlobSASQueryParameters({
    containerName: CONFIG.storage.container,
    blobName,
    permissions: BlobSASPermissions.parse('r'),
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  }, sharedKeyCredential).toString();
  return `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}/${encodeURIComponent(blobName)}?${sasToken}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: DOKÜMAN YAPI ANALİZİ
// ═══════════════════════════════════════════════════════════════════════════

async function step1_analyzeStructure(layoutResult) {
  const pageCount = layoutResult.pages?.length || 0;
  const tableCount = layoutResult.tables?.length || 0;
  
  // İlk 2 sayfanın metnini al
  const firstPages = layoutResult.pages?.slice(0, 2).map(p => 
    p.lines?.map(l => l.content).join('\n')
  ).join('\n\n') || '';

  const prompt = `Bu bir kamu ihale dokümanının ilk 2 sayfası. Hızlıca analiz et:

DOKÜMAN:
${firstPages.substring(0, 3000)}

SORULAR:
1. Bu ne tür bir ihale? (malzemeli_yemek / personel_temini / organizasyon / diger)
2. İdare/kurum adı ne?
3. İhale konusu ne?
4. Toplam sayfa: ${pageCount}, Tablo: ${tableCount}

JSON formatında cevap ver:
{
  "ihale_tipi": "malzemeli_yemek",
  "idare_adi": "...",
  "ihale_konusu": "...",
  "notlar": "varsa önemli gözlemler"
}`;

  try {
    const response = await anthropic.messages.create({
      model: CONFIG.anthropic.model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });
    
    const match = response.content[0].text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (e) {
    console.log(`      ⚠️ Step 1 hatası: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: TABLO SINIFLANDIRMA (TEK TEK)
// ═══════════════════════════════════════════════════════════════════════════

async function step2_classifyTables(layoutResult, docContext) {
  const tables = layoutResult.tables || [];
  if (tables.length === 0) return [];

  const classifiedTables = [];
  
  // Tabloları batch'lere ayır (5'erli)
  const batchSize = 5;
  for (let i = 0; i < tables.length; i += batchSize) {
    const batch = tables.slice(i, i + batchSize);
    
    const tableDescriptions = batch.map((table, idx) => {
      const actualIdx = i + idx;
      const headers = table.cells?.filter(c => c.rowIndex === 0).map(c => c.content).join(' | ') || '';
      const firstRow = table.cells?.filter(c => c.rowIndex === 1).map(c => c.content).join(' | ') || '';
      const page = table.boundingRegions?.[0]?.pageNumber || '?';
      return `[Tablo ${actualIdx}] Sayfa ${page}, ${table.rowCount}x${table.columnCount}
  Başlık: ${headers.substring(0, 150)}
  İlk satır: ${firstRow.substring(0, 100)}`;
    }).join('\n\n');

    const prompt = `Bu bir "${docContext?.ihale_tipi || 'yemek'}" ihalesinin tabloları. Her tabloyu sınıflandır.

TABLOLAR:
${tableDescriptions}

SINIFLAR:
${TABLE_TYPES.map(t => `- ${t}`).join('\n')}

JSON formatında cevap:
{
  "tables": [
    {"index": 0, "type": "gramaj_tablosu", "confidence": "high"},
    {"index": 1, "type": "haftalik_menu_1", "confidence": "medium"}
  ]
}

KURALLAR:
- Haftalık menüler için hafta numarasını doğru belirle (1. hafta, 2. hafta...)
- Gramaj tablosu: gram, porsiyon, miktar içeren tablolar
- Yemek grupları: "Birinci Grup", "Çorba", "Ana Yemek" gibi kategoriler
- Emin değilsen "diger" yaz`;

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.anthropic.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const match = response.content[0].text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        classifiedTables.push(...(result.tables || []));
      }
    } catch (e) {
      console.log(`      ⚠️ Step 2 batch hatası: ${e.message}`);
    }
  }

  return classifiedTables;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: STRING ALAN ÇIKARMA (SAYFA SAYFA)
// ═══════════════════════════════════════════════════════════════════════════

async function step3_extractStrings(layoutResult, docContext) {
  const pages = layoutResult.pages || [];
  const extractedFields = {};

  // Sadece ilk 5 sayfayı detaylı analiz et (çoğu bilgi orada)
  const pagesToAnalyze = Math.min(pages.length, 5);
  
  for (let i = 0; i < pagesToAnalyze; i++) {
    const page = pages[i];
    const pageText = page.lines?.map(l => l.content).join('\n') || '';
    
    if (pageText.length < 100) continue; // Boş sayfaları atla

    const prompt = `Bu "${docContext?.ihale_tipi || 'yemek'}" ihalesinin ${i + 1}. sayfası. Aşağıdaki alanları bul:

SAYFA METNİ:
${pageText.substring(0, 4000)}

ARANACAK ALANLAR:

🔴 KRİTİK:
- ihale_konusu: İhalenin konusu/adı
- ihale_kayit_no: İKN numarası (2024/123456 formatı)
- idare_adi: Kurum adı
- gunluk_kisi_sayisi: Günlük yemek yiyecek kişi
- isci_sayisi: Çalıştırılacak işçi sayısı
- ogun_sayisi: Günlük öğün sayısı
- sozlesme_suresi: Sözleşme süresi
- hizmet_gun_sayisi: Toplam hizmet günü
- iscilik_orani: İşçilik oranı (%)

🟡 ÖNEMLİ:
- yemek_cesit_sayisi: Öğün başına çeşit ("4 çeşit yemek")
- ise_baslama_tarihi: Başlama tarihi
- is_bitis_tarihi: Bitiş tarihi
- yaklasik_maliyet: Yaklaşık maliyet
- mutfak_tipi: yerinde/taşımalı/merkezi
- servis_tipi: benmari/self servis/tabldot
- servis_saati: Servis saati (12:30 gibi)
- teslim_yeri: Dağıtım yeri
- et_tipi: dana/tavuk/karışık

🔵 EVET/HAYIR:
- kahvalti_var: Kahvaltı hizmeti var mı?
- ara_ogun_var: Ara öğün var mı?
- gece_yemegi_var: Gece yemeği var mı?
- diyet_menu_var: Diyet menü var mı?
- ekmek_dahil: Ekmek dahil mi?

JSON formatında cevap (sadece bu sayfada BULUNANLAR):
{
  "fields": [
    {"field": "ihale_konusu", "value": "Malzemeli Yemek Hizmeti", "confidence": "high"},
    {"field": "kahvalti_var", "value": "evet", "confidence": "medium"}
  ]
}`;

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.anthropic.model,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const match = response.content[0].text.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        for (const f of (result.fields || [])) {
          // İlk bulunan değeri al (daha sonraki sayfalarda tekrar bulursa güncelleme)
          if (!extractedFields[f.field] || f.confidence === 'high') {
            extractedFields[f.field] = { ...f, page: i + 1 };
          }
        }
      }
    } catch (e) {
      console.log(`      ⚠️ Step 3 sayfa ${i + 1} hatası: ${e.message}`);
    }
  }

  return Object.values(extractedFields);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: ÇAPRAZ DOĞRULAMA
// ═══════════════════════════════════════════════════════════════════════════

async function step4_validate(tables, strings, docContext) {
  // Basit tutarlılık kontrolleri
  const issues = [];

  // İşçi sayısı kontrolü
  const isciSayisi = strings.find(s => s.field === 'isci_sayisi');
  const personnelTable = tables.find(t => t.type === 'personel_tablosu');
  if (isciSayisi && !personnelTable) {
    issues.push('İşçi sayısı belirtilmiş ama personel tablosu bulunamadı');
  }

  // Menü kontrolü
  const menuTables = tables.filter(t => t.type.includes('menu'));
  if (menuTables.length < 2) {
    issues.push('KİK mevzuatı en az 2 haftalık menü gerektiriyor');
  }

  // Gramaj kontrolü
  const gramajTable = tables.find(t => t.type === 'gramaj_tablosu');
  if (!gramajTable) {
    issues.push('Gramaj tablosu bulunamadı (aşırı düşük teklif için gerekli)');
  }

  return { valid: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// LABEL OLUŞTURMA
// ═══════════════════════════════════════════════════════════════════════════

function createLabels(layoutResult, tables, strings) {
  const labels = [];

  // Tablo etiketleri
  for (const t of tables) {
    if (t.type === 'diger' || t.confidence === 'low') continue;
    
    const table = layoutResult.tables?.[t.index];
    if (table?.boundingRegions?.[0]) {
      const region = table.boundingRegions[0];
      labels.push({
        label: t.type,
        labelType: 'table',
        value: [{
          pageNumber: region.pageNumber,
          boundingBox: polygonToBox(region.polygon),
          tableIndex: t.index,
        }],
      });
    }
  }

  // String etiketleri
  for (const s of strings) {
    if (s.confidence === 'low') continue;
    
    const page = layoutResult.pages?.find(p => p.pageNumber === s.page);
    let foundLine = null;
    
    if (page?.lines && s.value) {
      const searchValue = String(s.value).toLowerCase().substring(0, 25);
      for (const line of page.lines) {
        if (line.content.toLowerCase().includes(searchValue)) {
          foundLine = line;
          break;
        }
      }
    }

    labels.push({
      label: s.field,
      value: [{
        pageNumber: s.page,
        boundingBox: foundLine?.polygon ? polygonToBox(foundLine.polygon) : null,
        text: String(s.value),
      }],
    });
  }

  return labels;
}

function polygonToBox(polygon) {
  if (!polygon || polygon.length < 4) return null;
  const xs = polygon.filter((_, i) => i % 2 === 0);
  const ys = polygon.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║     SMART LABEL v4 - Multi-Step Pipeline                                ║');
  console.log('║     4 Aşama: Yapı → Tablo → String → Doğrulama                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // PDF listesi
  const pdfs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) pdfs.push(blob.name);
  }
  console.log(`📄 ${pdfs.length} PDF bulundu\n`);

  let processed = 0, errors = 0, totalLabels = 0;
  const stats = { tables: {}, strings: {} };

  for (const pdfName of pdfs) {
    processed++;
    console.log(`\n${'═'.repeat(76)}`);
    console.log(`[${processed}/${pdfs.length}] ${pdfName.substring(0, 55)}...`);

    try {
      // Azure Layout
      console.log('   📊 Azure Layout analizi...');
      const blobSasUrl = getBlobSasUrl(pdfName);
      const poller = await docClient.beginAnalyzeDocumentFromUrl('prebuilt-layout', blobSasUrl);
      const layoutResult = await poller.pollUntilDone();

      // STEP 1: Yapı Analizi
      console.log('   🔍 Step 1: Doküman yapısı...');
      const docContext = await step1_analyzeStructure(layoutResult);
      if (docContext) {
        console.log(`      Tip: ${docContext.ihale_tipi || '?'}, İdare: ${(docContext.idare_adi || '?').substring(0, 30)}`);
      }

      // STEP 2: Tablo Sınıflandırma
      console.log('   📋 Step 2: Tablo sınıflandırma...');
      const classifiedTables = await step2_classifyTables(layoutResult, docContext);
      const tableTypes = [...new Set(classifiedTables.filter(t => t.type !== 'diger').map(t => t.type))];
      console.log(`      ${classifiedTables.length} tablo → ${tableTypes.length} tip: ${tableTypes.slice(0, 5).join(', ')}`);

      // STEP 3: String Çıkarma
      console.log('   📝 Step 3: String alanlar...');
      const extractedStrings = await step3_extractStrings(layoutResult, docContext);
      console.log(`      ${extractedStrings.length} alan bulundu`);

      // STEP 4: Doğrulama
      console.log('   ✓  Step 4: Doğrulama...');
      const validation = await step4_validate(classifiedTables, extractedStrings, docContext);
      if (!validation.valid) {
        console.log(`      ⚠️ Uyarılar: ${validation.issues.slice(0, 2).join('; ')}`);
      }

      // Label oluştur ve kaydet
      const labels = createLabels(layoutResult, classifiedTables, extractedStrings);
      
      if (labels.length === 0) {
        console.log('   ⚠️ Etiketlenecek alan bulunamadı');
        continue;
      }

      const labelFileName = pdfName + '.labels.json';
      const labelData = { document: pdfName, labels, validation };
      const labelContent = JSON.stringify(labelData, null, 2);
      await containerClient.getBlockBlobClient(labelFileName).upload(
        labelContent, labelContent.length,
        { blobHTTPHeaders: { blobContentType: 'application/json' } }
      );

      // İstatistikler
      totalLabels += labels.length;
      labels.filter(l => l.labelType === 'table').forEach(l => {
        stats.tables[l.label] = (stats.tables[l.label] || 0) + 1;
      });
      labels.filter(l => l.labelType !== 'table').forEach(l => {
        stats.strings[l.label] = (stats.strings[l.label] || 0) + 1;
      });

      console.log(`   ✅ ${labels.length} etiket kaydedildi`);

    } catch (error) {
      errors++;
      console.log(`   ❌ Hata: ${error.message}`);
    }

    await sleep(1000);
  }

  // Özet
  console.log(`\n${'═'.repeat(76)}`);
  console.log('📊 ÖZET');
  console.log(`${'═'.repeat(76)}`);
  console.log(`✅ Başarılı: ${processed - errors}/${processed}`);
  console.log(`🏷️ Toplam Etiket: ${totalLabels}`);
  
  console.log('\n📊 EN ÇOK BULUNAN TABLOLAR:');
  Object.entries(stats.tables).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  
  console.log('\n📝 EN ÇOK BULUNAN ALANLAR:');
  Object.entries(stats.strings).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log(`   ${k}: ${v}`));
}

main().catch(console.error);
