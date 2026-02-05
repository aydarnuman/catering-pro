/**
 * SMART LABEL v5 - Enhanced Table Extraction
 * 
 * 🔴 ODAK: Öğün ve Personel Tablolarının Detaylı Etiketlenmesi
 * 
 * Yenilikler:
 * 1. Öğün tablosu alt-alanları (kahvaltı/öğle/akşam kişi sayıları)
 * 2. Personel tablosu alt-alanları (pozisyon, sayı, nitelik)
 * 3. Satır bazında veri extraction
 * 4. Tablo içi değer eşleştirme
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
// GELİŞMİŞ TABLO TİPLERİ ve ALT-ALANLAR
// ═══════════════════════════════════════════════════════════════════════════

const TABLE_SCHEMAS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 ÖĞÜN TABLOLARI (Kritik)
  // ═══════════════════════════════════════════════════════════════════════════
  ogun_dagilimi: {
    description: 'Öğün dağılım tablosu - Kahvaltı/Öğle/Akşam kişi sayıları',
    priority: 'critical',
    keywords: ['öğün', 'kahvaltı', 'öğle', 'akşam', 'yemekhane', 'kişi sayısı', 'adet'],
    subFields: {
      kahvalti_kisi_sayisi: { type: 'number', description: 'Kahvaltı yiyen kişi sayısı' },
      ogle_kisi_sayisi: { type: 'number', description: 'Öğle yemeği yiyen kişi sayısı' },
      aksam_kisi_sayisi: { type: 'number', description: 'Akşam yemeği yiyen kişi sayısı' },
      gece_kisi_sayisi: { type: 'number', description: 'Gece/sahur yiyen kişi sayısı (varsa)' },
      ara_ogun_kisi_sayisi: { type: 'number', description: 'Ara öğün yiyen kişi sayısı (varsa)' },
      toplam_gunluk_ogun: { type: 'number', description: 'Günlük toplam öğün adedi' },
      servis_noktalari: { type: 'array', description: 'Yemekhaneler/servis noktaları listesi' },
    },
    extractionPrompt: `Bu tabloda öğün dağılımı bilgisi var. Her satırı analiz et ve şu bilgileri çıkar:

ARANAN BİLGİLER:
1. Kahvaltı yiyen kişi sayısı (sabah kahvaltı)
2. Öğle yemeği yiyen kişi sayısı
3. Akşam yemeği yiyen kişi sayısı
4. Gece yemeği/sahur (varsa)
5. Ara öğün (varsa)
6. Servis noktaları/yemekhaneler (varsa)

NOT: Tabloda "Normal", "Diyet", "Refakatçi" gibi kategoriler olabilir - hepsini topla.
NOT: "Kişi" yerine "öğün", "porsiyon", "adet" de kullanılabilir.

JSON formatında döndür:
{
  "kahvalti_kisi_sayisi": 500,
  "ogle_kisi_sayisi": 1200,
  "aksam_kisi_sayisi": 800,
  "gece_kisi_sayisi": 0,
  "ara_ogun_kisi_sayisi": 0,
  "toplam_gunluk_ogun": 2500,
  "servis_noktalari": ["A Blok", "B Blok"],
  "raw_rows": [
    {"satir": 1, "icerik": "Kahvaltı - 500 kişi"},
    ...
  ]
}`,
  },

  ogun_detay: {
    description: 'Detaylı öğün tablosu - Birim, kategori ve sayılarla',
    priority: 'high',
    keywords: ['birim', 'hasta', 'personel', 'refakatçi', 'diyet', 'normal'],
    subFields: {
      birimler: { type: 'array', description: 'Birim bazında dağılım' },
      kategoriler: { type: 'object', description: 'Normal/Diyet/Refakatçi gibi kategoriler' },
    },
    extractionPrompt: `Bu detaylı öğün tablosunu analiz et. Birim ve kategori bazında ayır:

ÖRNEK YAPI:
| Birim | Normal Öğle | Diyet Öğle | Refakatçi |
| A Blok | 200 | 50 | 30 |
| B Blok | 150 | 40 | 20 |

JSON formatında döndür:
{
  "birimler": [
    {
      "birim_adi": "A Blok",
      "normal_ogle": 200,
      "diyet_ogle": 50,
      "refakatci": 30,
      "toplam": 280
    }
  ],
  "kategoriler": {
    "normal": 350,
    "diyet": 90,
    "refakatci": 50
  },
  "genel_toplam": 490
}`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔴 PERSONEL TABLOLARI (Kritik)
  // ═══════════════════════════════════════════════════════════════════════════
  personel_tablosu: {
    description: 'Personel gereksinimleri tablosu - Pozisyon, sayı, nitelik',
    priority: 'critical',
    keywords: ['personel', 'işçi', 'aşçı', 'çalışan', 'kadro', 'görev', 'sayısı'],
    subFields: {
      toplam_personel: { type: 'number', description: 'Toplam personel sayısı' },
      asci_sayisi: { type: 'number', description: 'Aşçı sayısı' },
      asci_yardimcisi_sayisi: { type: 'number', description: 'Aşçı yardımcısı sayısı' },
      servis_elemani_sayisi: { type: 'number', description: 'Servis/garson sayısı' },
      bulasikci_sayisi: { type: 'number', description: 'Bulaşıkçı sayısı' },
      temizlik_personeli_sayisi: { type: 'number', description: 'Temizlik personeli sayısı' },
      diyetisyen_sayisi: { type: 'number', description: 'Diyetisyen sayısı' },
      gida_muhendisi_sayisi: { type: 'number', description: 'Gıda mühendisi sayısı' },
      sofor_sayisi: { type: 'number', description: 'Şoför sayısı (taşımalı ise)' },
      yonetici_sayisi: { type: 'number', description: 'Mutfak şefi/yönetici sayısı' },
      personel_detay: { type: 'array', description: 'Pozisyon bazında detaylı liste' },
    },
    extractionPrompt: `Bu personel tablosunu analiz et. Her pozisyonu ayrı ayrı çıkar:

ARANAN POZISYONLAR:
- Aşçı (Baş aşçı, 1. Aşçı, 2. Aşçı dahil)
- Aşçı Yardımcısı
- Servis Elemanı / Garson
- Bulaşıkçı
- Temizlik Personeli
- Diyetisyen
- Gıda Mühendisi
- Şoför
- Mutfak Şefi / Yönetici

NOT: Aynı pozisyon farklı isimlerle yazılabilir (ör: "yardımcı personel" = "aşçı yardımcısı")
NOT: Bazı tablolarda "kişi", bazılarında sadece sayı yazar.

JSON formatında döndür:
{
  "toplam_personel": 25,
  "asci_sayisi": 5,
  "asci_yardimcisi_sayisi": 8,
  "servis_elemani_sayisi": 6,
  "bulasikci_sayisi": 3,
  "temizlik_personeli_sayisi": 2,
  "diyetisyen_sayisi": 1,
  "gida_muhendisi_sayisi": 0,
  "sofor_sayisi": 0,
  "yonetici_sayisi": 0,
  "personel_detay": [
    {"pozisyon": "Aşçı", "sayi": 5, "nitelik": "Ustalık belgeli"},
    {"pozisyon": "Aşçı Yardımcısı", "sayi": 8, "nitelik": null},
    ...
  ]
}`,
  },

  personel_nitelikleri: {
    description: 'Personel nitelikleri tablosu - Belgeler, sertifikalar',
    priority: 'high',
    keywords: ['belge', 'sertifika', 'ustalık', 'diploma', 'hijyen', 'eğitim'],
    subFields: {
      gerekli_belgeler: { type: 'array', description: 'Gereken belgeler listesi' },
    },
    extractionPrompt: `Bu tabloda personel nitelikleri/belge gereksinimleri var. Çıkar:

JSON formatında döndür:
{
  "gerekli_belgeler": [
    {"pozisyon": "Aşçı", "belgeler": ["Ustalık belgesi", "Hijyen sertifikası"]},
    {"pozisyon": "Diyetisyen", "belgeler": ["Lisans diploması"]},
    ...
  ]
}`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MENÜ TABLOLARI
  // ═══════════════════════════════════════════════════════════════════════════
  haftalik_menu: {
    description: 'Haftalık örnek menü tablosu',
    priority: 'high',
    keywords: ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'hafta', 'gün'],
    weekNumber: null, // 1, 2, 3, 4 olarak set edilecek
    subFields: {
      hafta_no: { type: 'number', description: 'Kaçıncı hafta (1-4)' },
      gunler: { type: 'array', description: 'Günlük menüler' },
    },
    extractionPrompt: `Bu haftalık menü tablosunu analiz et:

JSON formatında döndür:
{
  "hafta_no": 1,
  "gunler": [
    {
      "gun": "Pazartesi",
      "corba": "Mercimek Çorbası",
      "ana_yemek": "Tavuk Sote",
      "pilav": "Pirinç Pilavı",
      "salata": "Mevsim Salata",
      "tatli": "Meyve"
    },
    ...
  ]
}`,
  },

  gramaj_tablosu: {
    description: 'Gramaj/porsiyon tablosu',
    priority: 'high',
    keywords: ['gram', 'porsiyon', 'çiğ', 'pişmiş', 'miktar', 'gr'],
    subFields: {
      yemekler: { type: 'array', description: 'Yemek gramajları listesi' },
    },
    extractionPrompt: `Bu gramaj tablosunu analiz et. Her yemeğin gramajını çıkar:

JSON formatında döndür:
{
  "yemekler": [
    {"yemek": "Mercimek Çorbası", "porsiyon_gr": 250, "cig_gr": null},
    {"yemek": "Tavuk Sote", "porsiyon_gr": 150, "cig_gr": 180},
    ...
  ]
}`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FİYAT TABLOLARI
  // ═══════════════════════════════════════════════════════════════════════════
  birim_fiyat_cetveli: {
    description: 'Birim fiyat teklif cetveli',
    priority: 'medium',
    keywords: ['birim fiyat', 'teklif', 'cetvel', 'KDV', 'toplam tutar'],
    subFields: {
      kalemler: { type: 'array', description: 'Fiyat kalemleri' },
      toplam: { type: 'number', description: 'Toplam tutar' },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DİĞER TABLOLAR
  // ═══════════════════════════════════════════════════════════════════════════
  malzeme_listesi: {
    description: 'Hammadde/malzeme listesi',
    priority: 'medium',
    keywords: ['malzeme', 'hammadde', 'ürün', 'gıda', 'liste'],
  },

  ekipman_listesi: {
    description: 'Mutfak ekipmanları listesi',
    priority: 'low',
    keywords: ['ekipman', 'araç', 'gereç', 'mutfak', 'makine'],
  },

  dagitim_noktalari: {
    description: 'Yemek dağıtım noktaları/yemekhaneler',
    priority: 'medium',
    keywords: ['yemekhane', 'dağıtım', 'servis noktası', 'lokasyon'],
  },

  ceza_kesintileri: {
    description: 'Ceza ve kesinti tablosu',
    priority: 'low',
    keywords: ['ceza', 'kesinti', 'yaptırım', 'ücret'],
  },

  diger: {
    description: 'Sınıflandırılamayan tablo',
    priority: 'low',
    keywords: [],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// STRING ALANLAR (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════════════════

const STRING_FIELDS = {
  critical: [
    { field: 'ihale_konusu', description: 'İhalenin konusu/adı', example: 'Malzemeli Yemek Hizmeti Alımı' },
    { field: 'ihale_kayit_no', description: 'İKN numarası', example: '2024/123456', pattern: /\d{4}\/\d+/ },
    { field: 'idare_adi', description: 'Kurum adı', example: 'T.C. Sağlık Bakanlığı X Hastanesi' },
    { field: 'gunluk_toplam_ogun', description: 'Günlük toplam öğün sayısı', example: '2500', type: 'number' },
    { field: 'toplam_personel', description: 'Toplam çalıştırılacak personel', example: '25', type: 'number' },
    { field: 'sozlesme_suresi', description: 'Sözleşme süresi', example: '24 ay' },
    { field: 'hizmet_gun_sayisi', description: 'Toplam hizmet günü', example: '730', type: 'number' },
    { field: 'iscilik_orani', description: 'İşçilik oranı', example: '%35', type: 'percentage' },
  ],
  important: [
    { field: 'yaklasik_maliyet', description: 'Yaklaşık maliyet', example: '50.000.000 TL', type: 'currency' },
    { field: 'ise_baslama_tarihi', description: 'İşe başlama tarihi', example: '01.01.2026', type: 'date' },
    { field: 'is_bitis_tarihi', description: 'İş bitiş tarihi', example: '31.12.2027', type: 'date' },
    { field: 'mutfak_tipi', description: 'Mutfak tipi', example: 'yerinde', options: ['yerinde', 'taşımalı', 'merkezi'] },
    { field: 'servis_tipi', description: 'Servis tipi', example: 'self servis', options: ['benmari', 'self servis', 'tabldot'] },
    { field: 'et_tipi', description: 'Et türü', example: 'dana', options: ['dana', 'tavuk', 'karışık'] },
  ],
  ogun_detay: [
    { field: 'kahvalti_kisi', description: 'Kahvaltı kişi sayısı', type: 'number' },
    { field: 'ogle_kisi', description: 'Öğle yemeği kişi sayısı', type: 'number' },
    { field: 'aksam_kisi', description: 'Akşam yemeği kişi sayısı', type: 'number' },
    { field: 'kahvalti_saati', description: 'Kahvaltı servis saati', example: '07:00-09:00' },
    { field: 'ogle_saati', description: 'Öğle yemeği servis saati', example: '11:30-13:30' },
    { field: 'aksam_saati', description: 'Akşam yemeği servis saati', example: '17:00-19:00' },
  ],
  boolean: [
    { field: 'kahvalti_var', description: 'Kahvaltı hizmeti var mı?' },
    { field: 'ara_ogun_var', description: 'Ara öğün var mı?' },
    { field: 'gece_yemegi_var', description: 'Gece yemeği var mı?' },
    { field: 'diyet_menu_var', description: 'Diyet menü var mı?' },
    { field: 'ekmek_dahil', description: 'Ekmek dahil mi?' },
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
  
  const firstPages = layoutResult.pages?.slice(0, 2).map(p => 
    p.lines?.map(l => l.content).join('\n')
  ).join('\n\n') || '';

  const prompt = `Bu bir kamu ihale dokümanının ilk 2 sayfası. Analiz et:

DOKÜMAN:
${firstPages.substring(0, 3000)}

JSON formatında cevap ver:
{
  "ihale_tipi": "malzemeli_yemek|personel_temini|organizasyon|diger",
  "idare_adi": "Kurum adı",
  "ihale_konusu": "İhale konusu",
  "tahmini_ogun": "Günlük toplam öğün tahmini (varsa)",
  "tahmini_personel": "Personel sayısı tahmini (varsa)",
  "notlar": "Önemli gözlemler"
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
// STEP 2: TABLO SINIFLANDIRMA (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════════════════

async function step2_classifyTables(layoutResult, docContext) {
  const tables = layoutResult.tables || [];
  if (tables.length === 0) return [];

  const classifiedTables = [];
  const tableTypes = Object.keys(TABLE_SCHEMAS);
  
  // Tabloları batch'lere ayır (3'erli - daha detaylı analiz için)
  const batchSize = 3;
  for (let i = 0; i < tables.length; i += batchSize) {
    const batch = tables.slice(i, i + batchSize);
    
    const tableDescriptions = batch.map((table, idx) => {
      const actualIdx = i + idx;
      const headers = table.cells?.filter(c => c.rowIndex === 0).map(c => c.content).join(' | ') || '';
      const firstRows = table.cells?.filter(c => c.rowIndex <= 2).map(c => `[${c.rowIndex},${c.columnIndex}]: ${c.content}`).join('\n') || '';
      const page = table.boundingRegions?.[0]?.pageNumber || '?';
      return `[Tablo ${actualIdx}] Sayfa ${page}, ${table.rowCount} satır x ${table.columnCount} sütun
  BAŞLIKLAR: ${headers.substring(0, 200)}
  İLK SATIRLAR:
  ${firstRows.substring(0, 400)}`;
    }).join('\n\n───────────────────\n\n');

    const prompt = `Bu tablolar "${docContext?.ihale_tipi || 'yemek'}" ihalesinden. Her tabloyu detaylı sınıflandır.

TABLOLAR:
${tableDescriptions}

SINIFLAR ve AÇIKLAMALARI:
${tableTypes.map(t => `- ${t}: ${TABLE_SCHEMAS[t].description}`).join('\n')}

🔴 KRİTİK KURALLAR:
1. ÖĞÜN TABLOSU: "kahvaltı", "öğle", "akşam", "kişi sayısı", "öğün" içeren tablolar → ogun_dagilimi veya ogun_detay
2. PERSONEL TABLOSU: "aşçı", "personel", "işçi", "sayısı", "kadro" içeren tablolar → personel_tablosu
3. HAFTALIK MENÜ: Gün isimleri (Pazartesi, Salı...) + yemek isimleri → haftalik_menu (hafta numarasını belirle)
4. GRAMAJ: "gram", "gr", "porsiyon", "çiğ", "pişmiş" → gramaj_tablosu

JSON formatında cevap:
{
  "tables": [
    {
      "index": 0,
      "type": "ogun_dagilimi",
      "confidence": "high",
      "reason": "Kahvaltı/öğle/akşam satırları ve kişi sayıları var",
      "detected_values": {
        "kahvalti": 500,
        "ogle": 1200,
        "aksam": 800
      }
    },
    {
      "index": 1,
      "type": "personel_tablosu",
      "confidence": "high",
      "reason": "Aşçı, servis elemanı pozisyonları ve sayıları var",
      "detected_values": {
        "toplam_personel": 25
      }
    }
  ]
}

NOT: detected_values içinde tabloda gördüğün sayısal değerleri MUTLAKA ekle!`;

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.anthropic.model,
        max_tokens: 800,
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
// STEP 3: KRİTİK TABLOLARDAN DETAYLI VERİ ÇIKARMA (YENİ)
// ═══════════════════════════════════════════════════════════════════════════

async function step3_extractTableData(layoutResult, classifiedTables) {
  const criticalTypes = ['ogun_dagilimi', 'ogun_detay', 'personel_tablosu'];
  const extractedData = {};

  for (const classified of classifiedTables) {
    if (!criticalTypes.includes(classified.type)) continue;
    if (classified.confidence === 'low') continue;

    const table = layoutResult.tables?.[classified.index];
    if (!table) continue;

    const schema = TABLE_SCHEMAS[classified.type];
    if (!schema?.extractionPrompt) continue;

    // Tablo içeriğini düzgün formata çevir
    const tableContent = formatTableContent(table);

    const prompt = `${schema.extractionPrompt}

TABLO İÇERİĞİ:
${tableContent}`;

    try {
      const response = await anthropic.messages.create({
        model: CONFIG.anthropic.model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });
      
      const match = response.content[0].text.match(/\{[\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        extractedData[classified.type] = {
          tableIndex: classified.index,
          pageNumber: table.boundingRegions?.[0]?.pageNumber,
          data,
        };
        
        console.log(`      ✓ ${classified.type}: ${JSON.stringify(data).substring(0, 100)}...`);
      }
    } catch (e) {
      console.log(`      ⚠️ Step 3 ${classified.type} hatası: ${e.message}`);
    }
  }

  return extractedData;
}

function formatTableContent(table) {
  const rows = {};
  for (const cell of (table.cells || [])) {
    if (!rows[cell.rowIndex]) rows[cell.rowIndex] = [];
    rows[cell.rowIndex][cell.columnIndex] = cell.content;
  }
  
  return Object.entries(rows)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([_, cols]) => cols.join(' | '))
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: STRING ALAN ÇIKARMA (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════════════════

async function step4_extractStrings(layoutResult, docContext, extractedTableData) {
  const pages = layoutResult.pages || [];
  const extractedFields = {};

  // Tablo verilerinden zaten çıkarılmış değerleri ekle
  if (extractedTableData.ogun_dagilimi?.data) {
    const ogun = extractedTableData.ogun_dagilimi.data;
    if (ogun.kahvalti_kisi_sayisi) extractedFields.kahvalti_kisi = { value: ogun.kahvalti_kisi_sayisi, source: 'table', confidence: 'high' };
    if (ogun.ogle_kisi_sayisi) extractedFields.ogle_kisi = { value: ogun.ogle_kisi_sayisi, source: 'table', confidence: 'high' };
    if (ogun.aksam_kisi_sayisi) extractedFields.aksam_kisi = { value: ogun.aksam_kisi_sayisi, source: 'table', confidence: 'high' };
    if (ogun.toplam_gunluk_ogun) extractedFields.gunluk_toplam_ogun = { value: ogun.toplam_gunluk_ogun, source: 'table', confidence: 'high' };
  }

  if (extractedTableData.personel_tablosu?.data) {
    const personel = extractedTableData.personel_tablosu.data;
    if (personel.toplam_personel) extractedFields.toplam_personel = { value: personel.toplam_personel, source: 'table', confidence: 'high' };
    if (personel.asci_sayisi) extractedFields.asci_sayisi = { value: personel.asci_sayisi, source: 'table', confidence: 'high' };
  }

  // Sadece ilk 5 sayfayı detaylı analiz et
  const pagesToAnalyze = Math.min(pages.length, 5);
  
  for (let i = 0; i < pagesToAnalyze; i++) {
    const page = pages[i];
    const pageText = page.lines?.map(l => l.content).join('\n') || '';
    
    if (pageText.length < 100) continue;

    const allFields = [...STRING_FIELDS.critical, ...STRING_FIELDS.important, ...STRING_FIELDS.ogun_detay];
    
    const prompt = `Bu "${docContext?.ihale_tipi || 'yemek'}" ihalesinin ${i + 1}. sayfası. Aşağıdaki alanları bul:

SAYFA METNİ:
${pageText.substring(0, 4000)}

ARANACAK ALANLAR:
${allFields.map(f => `- ${f.field}: ${f.description}${f.example ? ` (örn: ${f.example})` : ''}`).join('\n')}

EVET/HAYIR ALANLARI:
${STRING_FIELDS.boolean.map(f => `- ${f.field}: ${f.description}`).join('\n')}

JSON formatında cevap (sadece bu sayfada BULUNANLAR):
{
  "fields": [
    {"field": "ihale_konusu", "value": "Malzemeli Yemek Hizmeti", "confidence": "high", "line": "İhale konusu: Malzemeli..."},
    {"field": "gunluk_toplam_ogun", "value": 2500, "confidence": "medium", "line": "Günlük 2500 öğün"}
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
          // Tablo verisinden zaten var mı kontrol et
          if (extractedFields[f.field]?.source === 'table' && extractedFields[f.field]?.confidence === 'high') {
            continue; // Tablo verisi öncelikli
          }
          
          if (!extractedFields[f.field] || f.confidence === 'high') {
            extractedFields[f.field] = { ...f, page: i + 1 };
          }
        }
      }
    } catch (e) {
      console.log(`      ⚠️ Step 4 sayfa ${i + 1} hatası: ${e.message}`);
    }
  }

  return Object.entries(extractedFields).map(([field, data]) => ({ field, ...data }));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: ÇAPRAZ DOĞRULAMA (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════════════════

async function step5_validate(tables, strings, tableData, docContext) {
  const issues = [];
  const warnings = [];

  // Öğün kontrolü
  const ogunTable = tables.find(t => t.type === 'ogun_dagilimi' || t.type === 'ogun_detay');
  const ogunString = strings.find(s => s.field === 'gunluk_toplam_ogun');
  
  if (!ogunTable && !ogunString) {
    issues.push('🔴 Öğün bilgisi bulunamadı (tablo veya metin)');
  } else if (ogunTable && tableData.ogun_dagilimi?.data) {
    const data = tableData.ogun_dagilimi.data;
    if (!data.kahvalti_kisi_sayisi && !data.ogle_kisi_sayisi) {
      warnings.push('⚠️ Öğün tablosu var ama kişi sayıları çıkarılamadı');
    }
  }

  // Personel kontrolü
  const personelTable = tables.find(t => t.type === 'personel_tablosu');
  const personelString = strings.find(s => s.field === 'toplam_personel');
  
  if (!personelTable && !personelString) {
    issues.push('🔴 Personel bilgisi bulunamadı (tablo veya metin)');
  } else if (personelTable && tableData.personel_tablosu?.data) {
    const data = tableData.personel_tablosu.data;
    if (!data.toplam_personel || data.toplam_personel === 0) {
      warnings.push('⚠️ Personel tablosu var ama toplam sayı çıkarılamadı');
    }
  }

  // Menü kontrolü
  const menuTables = tables.filter(t => t.type === 'haftalik_menu' || t.type === 'ornek_menu');
  if (menuTables.length < 2) {
    warnings.push('⚠️ KİK mevzuatı en az 2 haftalık menü gerektiriyor');
  }

  // Gramaj kontrolü
  const gramajTable = tables.find(t => t.type === 'gramaj_tablosu');
  if (!gramajTable) {
    warnings.push('⚠️ Gramaj tablosu bulunamadı');
  }

  return { 
    valid: issues.length === 0, 
    issues,
    warnings,
    score: Math.round(100 - (issues.length * 25) - (warnings.length * 10))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LABEL OLUŞTURMA (GELİŞMİŞ)
// ═══════════════════════════════════════════════════════════════════════════

function createLabels(layoutResult, tables, strings, tableData) {
  const labels = [];

  // Tablo etiketleri
  for (const t of tables) {
    if (t.type === 'diger' || t.confidence === 'low') continue;
    
    const table = layoutResult.tables?.[t.index];
    if (table?.boundingRegions?.[0]) {
      const region = table.boundingRegions[0];
      const labelObj = {
        label: t.type,
        labelType: 'table',
        value: [{
          pageNumber: region.pageNumber,
          boundingBox: polygonToBox(region.polygon),
          tableIndex: t.index,
        }],
      };

      // Kritik tablolar için çıkarılmış veriyi ekle
      if (tableData[t.type]?.data) {
        labelObj.extractedData = tableData[t.type].data;
      }
      
      // Sınıflandırma sebebini ekle
      if (t.reason) {
        labelObj.reason = t.reason;
      }

      labels.push(labelObj);
    }
  }

  // Alt-alan etiketleri (öğün ve personel için)
  if (tableData.ogun_dagilimi?.data) {
    const ogun = tableData.ogun_dagilimi.data;
    if (ogun.kahvalti_kisi_sayisi) {
      labels.push({
        label: 'kahvalti_kisi_sayisi',
        value: [{ text: String(ogun.kahvalti_kisi_sayisi), pageNumber: tableData.ogun_dagilimi.pageNumber }],
        source: 'ogun_dagilimi_table',
      });
    }
    if (ogun.ogle_kisi_sayisi) {
      labels.push({
        label: 'ogle_kisi_sayisi',
        value: [{ text: String(ogun.ogle_kisi_sayisi), pageNumber: tableData.ogun_dagilimi.pageNumber }],
        source: 'ogun_dagilimi_table',
      });
    }
    if (ogun.aksam_kisi_sayisi) {
      labels.push({
        label: 'aksam_kisi_sayisi',
        value: [{ text: String(ogun.aksam_kisi_sayisi), pageNumber: tableData.ogun_dagilimi.pageNumber }],
        source: 'ogun_dagilimi_table',
      });
    }
  }

  if (tableData.personel_tablosu?.data) {
    const personel = tableData.personel_tablosu.data;
    if (personel.toplam_personel) {
      labels.push({
        label: 'toplam_personel_sayisi',
        value: [{ text: String(personel.toplam_personel), pageNumber: tableData.personel_tablosu.pageNumber }],
        source: 'personel_table',
      });
    }
    if (personel.personel_detay?.length) {
      labels.push({
        label: 'personel_detay',
        value: personel.personel_detay,
        source: 'personel_table',
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
      source: s.source || 'text',
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
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     SMART LABEL v5 - Enhanced Table Extraction                              ║');
  console.log('║     🔴 ODAK: Öğün ve Personel Tabloları                                     ║');
  console.log('║     5 Aşama: Yapı → Tablo → Veri Çıkarma → String → Doğrulama               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // PDF listesi
  const pdfs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) pdfs.push(blob.name);
  }
  console.log(`📄 ${pdfs.length} PDF bulundu\n`);

  let processed = 0, errors = 0, totalLabels = 0;
  const stats = { 
    tables: {}, 
    strings: {},
    ogun_extracted: 0,
    personel_extracted: 0,
    validation_scores: [],
  };

  for (const pdfName of pdfs) {
    processed++;
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`[${processed}/${pdfs.length}] ${pdfName.substring(0, 60)}...`);

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
        console.log(`      Tip: ${docContext.ihale_tipi || '?'}, İdare: ${(docContext.idare_adi || '?').substring(0, 40)}`);
      }

      // STEP 2: Tablo Sınıflandırma
      console.log('   📋 Step 2: Tablo sınıflandırma...');
      const classifiedTables = await step2_classifyTables(layoutResult, docContext);
      const ogunTables = classifiedTables.filter(t => t.type.includes('ogun'));
      const personelTables = classifiedTables.filter(t => t.type.includes('personel'));
      console.log(`      ${classifiedTables.length} tablo → Öğün: ${ogunTables.length}, Personel: ${personelTables.length}`);

      // STEP 3: Kritik Tablo Verisi Çıkarma (YENİ)
      console.log('   🔴 Step 3: Kritik tablo verisi çıkarma...');
      const extractedTableData = await step3_extractTableData(layoutResult, classifiedTables);

      if (Object.keys(extractedTableData).length > 0) {
        if (extractedTableData.ogun_dagilimi) stats.ogun_extracted++;
        if (extractedTableData.personel_tablosu) stats.personel_extracted++;
      }

      // STEP 4: String Çıkarma
      console.log('   📝 Step 4: String alanlar...');
      const extractedStrings = await step4_extractStrings(layoutResult, docContext, extractedTableData);
      console.log(`      ${extractedStrings.length} alan bulundu`);

      // STEP 5: Doğrulama
      console.log('   ✓  Step 5: Doğrulama...');
      const validation = await step5_validate(classifiedTables, extractedStrings, extractedTableData, docContext);
      stats.validation_scores.push(validation.score);
      
      if (validation.issues.length > 0) {
        validation.issues.forEach(i => console.log(`      ${i}`));
      }
      if (validation.warnings.length > 0) {
        validation.warnings.slice(0, 2).forEach(w => console.log(`      ${w}`));
      }
      console.log(`      Skor: ${validation.score}/100`);

      // Label oluştur ve kaydet
      const labels = createLabels(layoutResult, classifiedTables, extractedStrings, extractedTableData);
      
      if (labels.length === 0) {
        console.log('   ⚠️ Etiketlenecek alan bulunamadı');
        continue;
      }

      const labelFileName = pdfName + '.labels.json';
      const labelData = { 
        document: pdfName, 
        labels, 
        validation,
        extractedTableData,
        version: 'v5',
        timestamp: new Date().toISOString(),
      };
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

    await sleep(1500); // Rate limiting için biraz daha bekle
  }

  // Özet
  console.log(`\n${'═'.repeat(80)}`);
  console.log('📊 ÖZET - SMART LABEL v5');
  console.log(`${'═'.repeat(80)}`);
  console.log(`✅ Başarılı: ${processed - errors}/${processed}`);
  console.log(`🏷️ Toplam Etiket: ${totalLabels}`);
  
  console.log('\n🔴 KRİTİK TABLO EXTRACTION:');
  console.log(`   Öğün tablosu verisi çıkarılan: ${stats.ogun_extracted}/${processed - errors}`);
  console.log(`   Personel tablosu verisi çıkarılan: ${stats.personel_extracted}/${processed - errors}`);
  
  if (stats.validation_scores.length > 0) {
    const avgScore = Math.round(stats.validation_scores.reduce((a, b) => a + b, 0) / stats.validation_scores.length);
    console.log(`   Ortalama doğrulama skoru: ${avgScore}/100`);
  }
  
  console.log('\n📊 EN ÇOK BULUNAN TABLOLAR:');
  Object.entries(stats.tables).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => console.log(`   ${k}: ${v}`));
  
  console.log('\n📝 EN ÇOK BULUNAN ALANLAR:');
  Object.entries(stats.strings).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log(`   ${k}: ${v}`));
}

main().catch(console.error);
