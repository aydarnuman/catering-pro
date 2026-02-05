/**
 * SMART LABEL v3 - KİK Mevzuatına Uygun Kapsamlı Etiketleme
 * 
 * Kaynaklar:
 * - KİK Genel Tebliği 79. madde (aşırı düşük teklif)
 * - Ek-H.4 Malzemeli Yemek Sunumu Hesap Cetveli
 * - 4734 sayılı Kamu İhale Kanunu 12. madde
 */

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

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
// ALAN TANIMLARI - KİK Mevzuatına Uygun
// ═══════════════════════════════════════════════════════════════════════════

const FIELD_DEFINITIONS = {
  // ─────────────────────────────────────────────────────────────────────────
  // TABLOLAR
  // ─────────────────────────────────────────────────────────────────────────
  tables: {
    // MENÜLER (KRİTİK - KİK 79.2.6: en az 2 haftalık örnek menü ZORUNLU)
    haftalik_menu_1: {
      description: '1. Hafta Menüsü',
      keywords: ['1. hafta', 'birinci hafta', '1.hafta', 'i. hafta', 'ilk hafta'],
      critical: true,
    },
    haftalik_menu_2: {
      description: '2. Hafta Menüsü',
      keywords: ['2. hafta', 'ikinci hafta', '2.hafta', 'ii. hafta'],
      critical: true,
    },
    haftalik_menu_3: {
      description: '3. Hafta Menüsü',
      keywords: ['3. hafta', 'üçüncü hafta', '3.hafta', 'iii. hafta'],
    },
    haftalik_menu_4: {
      description: '4. Hafta Menüsü',
      keywords: ['4. hafta', 'dördüncü hafta', '4.hafta', 'iv. hafta'],
    },
    ornek_menu: {
      description: 'Örnek Menü (hafta belirtilmemiş)',
      keywords: ['örnek menü', 'menü tablosu', 'yemek listesi', 'günlük menü'],
    },
    
    // GRAMAJ/REÇETE (KRİTİK - Ek-H.4 için çiğ girdi miktarları ZORUNLU)
    gramaj_tablosu: {
      description: 'Gramaj/Porsiyon/Çiğ Girdi Tablosu',
      keywords: ['gramaj', 'porsiyon', 'çiğ girdi', 'reçete', 'miktar', 'gram', 'kg', 'lt', 'adet'],
      critical: true,
    },
    
    // YEMEK GRUPLARI
    yemek_gruplari: {
      description: 'Yemek Grupları Tablosu (Çorba, Ana Yemek, Yardımcı...)',
      keywords: ['birinci grup', 'ikinci grup', 'yemek grubu', 'çorba grubu', 'ana yemek grubu'],
    },
    
    // ÖĞÜN DAĞILIMI
    ogun_dagilimi: {
      description: 'Öğün Dağılım Tablosu',
      keywords: ['öğün dağılım', 'kahvaltı', 'öğle', 'akşam', 'ara öğün', 'gece', 'öğün tablosu'],
    },
    
    // PERSONEL (İşçilik maliyeti için gerekli)
    personel_tablosu: {
      description: 'Personel/İşçi Listesi',
      keywords: ['personel', 'çalışan', 'işçi', 'görevli', 'unvan', 'aşçı', 'garson', 'komi', 'temizlik'],
      critical: true,
    },
    
    // MALİYET (Ek-H.4 hesaplaması için)
    birim_fiyat_cetveli: {
      description: 'Birim Fiyat Teklif Cetveli',
      keywords: ['birim fiyat', 'teklif cetveli', 'fiyat teklif', 'maliyet cetveli'],
      critical: true,
    },
    fiyat_tablosu: {
      description: 'Fiyat/Maliyet Tablosu',
      keywords: ['fiyat', 'tutar', 'bedel', 'maliyet', 'tl', '₺'],
    },
    
    // MALZEME/EKİPMAN
    malzeme_listesi: {
      description: 'Malzeme/Hammadde Listesi',
      keywords: ['malzeme', 'hammadde', 'gıda', 'ürün listesi', 'tedarik'],
    },
    ekipman_listesi: {
      description: 'Ekipman/Araç-Gereç Listesi',
      keywords: ['ekipman', 'araç gereç', 'demirbaş', 'mutfak malzeme', 'teçhizat'],
    },
    
    // DAĞITIM
    dagitim_noktalari: {
      description: 'Dağıtım Noktaları/Yemekhaneler',
      keywords: ['dağıtım', 'yemekhane', 'servis noktası', 'lokasyon', 'bina'],
    },
    
    // CEZA/KESİNTİ
    ceza_kesintileri: {
      description: 'Ceza/Kesinti Tablosu',
      keywords: ['ceza', 'kesinti', 'yaptırım', 'puan', 'cezai şart', 'para ceza'],
    },
    
    // KALİTE
    kalite_standartlari: {
      description: 'Kalite Standartları Tablosu',
      keywords: ['kalite', 'standart', 'hijyen', 'ISO', 'HACCP', 'TSE'],
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // STRING ALANLAR
  // ─────────────────────────────────────────────────────────────────────────
  strings: {
    // TEMEL İHALE BİLGİLERİ
    ihale_konusu: {
      description: 'İhalenin Konusu',
      patterns: [
        /ihale(?:nin)?\s*konusu\s*[:\-]?\s*(.+)/i,
        /işin\s*(?:adı|konusu)\s*[:\-]?\s*(.+)/i,
      ],
      critical: true,
    },
    ihale_kayit_no: {
      description: 'İhale Kayıt Numarası (İKN)',
      patterns: [
        /(?:İKN|ihale kayıt no|kayıt numarası)\s*[:\-]?\s*(\d{4}\/\d+)/i,
        /(\d{4}\/\d{5,})/,
      ],
      critical: true,
    },
    idare_adi: {
      description: 'İdare/Kurum Adı',
      patterns: [
        /(?:idare(?:nin)?\s*adı|kurum(?:un)?\s*adı)\s*[:\-]?\s*(.+)/i,
        /T\.C\.\s*(.+?)\s*(?:VALİLİĞİ|BAŞKANLIĞI|MÜDÜRLÜĞÜ)/i,
      ],
      critical: true,
    },
    
    // KİŞİ SAYILARI (Teklif hesaplaması için KRİTİK)
    gunluk_kisi_sayisi: {
      description: 'Günlük Yemek Yiyecek Kişi Sayısı',
      patterns: [
        /(?:günlük|ortalama)\s*(?:kişi|öğrenci|personel)\s*sayısı\s*[:\-]?\s*(\d+)/i,
        /(\d+)\s*kişi(?:lik)?/i,
      ],
      critical: true,
    },
    toplam_kisi_sayisi: {
      description: 'Toplam Kişi Sayısı',
      patterns: [
        /toplam\s*(?:kişi|öğrenci|personel)\s*sayısı\s*[:\-]?\s*(\d+)/i,
      ],
    },
    
    // İŞÇİ SAYISI (Ek-H.4 işçilik maliyeti için ZORUNLU)
    isci_sayisi: {
      description: 'Çalıştırılacak İşçi/Personel Sayısı',
      patterns: [
        /(?:işçi|personel|çalışan|eleman)\s*sayısı\s*[:\-]?\s*(\d+)/i,
        /(\d+)\s*(?:kişi)?\s*(?:işçi|personel|çalışan)/i,
      ],
      critical: true,
    },
    
    // ÖĞÜN BİLGİLERİ
    ogun_sayisi: {
      description: 'Günlük Öğün Sayısı',
      patterns: [
        /(?:günlük)?\s*öğün\s*sayısı\s*[:\-]?\s*(\d+)/i,
        /(\d+)\s*öğün/i,
      ],
      critical: true,
    },
    yemek_cesit_sayisi: {
      description: 'Öğün Başına Yemek Çeşit Sayısı',
      patterns: [
        /(\d+)\s*çeşit\s*yemek/i,
        /yemek\s*çeşit(?:i)?\s*[:\-]?\s*(\d+)/i,
      ],
    },
    
    // SÜRE BİLGİLERİ
    sozlesme_suresi: {
      description: 'Sözleşme/Hizmet Süresi',
      patterns: [
        /(?:sözleşme|hizmet|iş)\s*süresi\s*[:\-]?\s*(.+)/i,
        /(\d+)\s*(?:ay|gün|yıl)(?:lık)?/i,
      ],
      critical: true,
    },
    hizmet_gun_sayisi: {
      description: 'Toplam Hizmet Gün Sayısı',
      patterns: [
        /(?:hizmet|çalışma|iş)\s*gün(?:ü)?\s*(?:sayısı)?\s*[:\-]?\s*(\d+)/i,
        /toplam\s*(\d+)\s*gün/i,
      ],
      critical: true,
    },
    ise_baslama_tarihi: {
      description: 'İşe Başlama Tarihi',
      patterns: [
        /(?:işe\s*başlama|başlangıç|başlama)\s*tarihi\s*[:\-]?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i,
      ],
    },
    is_bitis_tarihi: {
      description: 'İş Bitiş Tarihi',
      patterns: [
        /(?:iş\s*bitim|bitiş|sona\s*erme)\s*tarihi\s*[:\-]?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i,
      ],
    },
    teklif_gecerlilik_suresi: {
      description: 'Teklif Geçerlilik Süresi',
      patterns: [
        /teklif(?:lerin)?\s*geçerlilik\s*süresi\s*[:\-]?\s*(.+)/i,
      ],
    },
    
    // MALİYET BİLGİLERİ (Ek-H.4 için)
    yaklasik_maliyet: {
      description: 'Yaklaşık Maliyet',
      patterns: [
        /yaklaşık\s*maliyet\s*[:\-]?\s*([\d\.,]+)/i,
        /tahmini\s*bedel\s*[:\-]?\s*([\d\.,]+)/i,
      ],
    },
    iscilik_orani: {
      description: 'İşçilik Oranı (%)',
      patterns: [
        /işçilik\s*oran[ıi]\s*[:\-]?\s*(%?\s*[\d\.,]+)/i,
      ],
      critical: true,
    },
    ogun_basi_fiyat: {
      description: 'Öğün Başı Birim Fiyat',
      patterns: [
        /öğün\s*(?:başı|başına)?\s*(?:birim)?\s*fiyat[ıi]?\s*[:\-]?\s*([\d\.,]+)/i,
        /birim\s*fiyat\s*[:\-]?\s*([\d\.,]+)/i,
      ],
    },
    
    // SERVİS DETAYLARI
    mutfak_tipi: {
      description: 'Mutfak Tipi (yerinde/taşımalı/merkezi)',
      patterns: [
        /mutfak\s*(?:tipi|türü)\s*[:\-]?\s*(yerinde|taşımalı|merkezi|dışarıda)/i,
        /(yerinde\s*pişirme|taşımalı|merkez(?:i)?\s*mutfak)/i,
      ],
    },
    servis_tipi: {
      description: 'Servis Tipi (benmari/self servis/tabldot)',
      patterns: [
        /servis\s*(?:tipi|şekli)\s*[:\-]?\s*(benmari|self\s*servis|tabldot|masaya\s*servis|paket)/i,
        /(benmari|self\s*servis|tabldot)/i,
      ],
    },
    servis_saati: {
      description: 'Servis Saati',
      patterns: [
        /(?:servis|yemek|dağıtım)\s*saat(?:i|leri)?\s*[:\-]?\s*(\d{1,2}[:\.\s]?\d{0,2})/i,
        /saat\s*(\d{1,2}[:\.]?\d{0,2})'?(?:de|da|te|ta)/i,
      ],
    },
    teslim_yeri: {
      description: 'Yemek Teslim/Dağıtım Yeri',
      patterns: [
        /(?:teslim|dağıtım|hizmet)\s*yeri\s*[:\-]?\s*(.+)/i,
      ],
    },
    
    // ÖĞÜN TÜRLERİ (var/yok)
    kahvalti_var: {
      description: 'Kahvaltı Hizmeti (evet/hayır)',
      patterns: [
        /(kahvaltı)/i,
      ],
      type: 'boolean',
    },
    ara_ogun_var: {
      description: 'Ara Öğün Hizmeti (evet/hayır)',
      patterns: [
        /(ara\s*öğün|ikindi|kuşluk)/i,
      ],
      type: 'boolean',
    },
    gece_yemegi_var: {
      description: 'Gece Yemeği Hizmeti (evet/hayır)',
      patterns: [
        /(gece\s*(?:yemeği|öğün)|sahur)/i,
      ],
      type: 'boolean',
    },
    diyet_menu_var: {
      description: 'Diyet Menü Hizmeti (evet/hayır)',
      patterns: [
        /(diyet|rejim|özel\s*menü)/i,
      ],
      type: 'boolean',
    },
    
    // GIDA GEREKSİNİMLERİ
    et_tipi: {
      description: 'Et Tipi (dana/tavuk/karışık)',
      patterns: [
        /(?:kullanılacak)?\s*et\s*(?:tipi|türü|çeşidi)?\s*[:\-]?\s*(dana|sığır|tavuk|kuzu|karışık)/i,
        /(dana|sığır|tavuk|kuzu)\s*et/i,
      ],
    },
    ekmek_dahil: {
      description: 'Ekmek Dahil mi?',
      patterns: [
        /(ekmek\s*(?:dahil|sınırsız|ücretsiz))/i,
      ],
      type: 'boolean',
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE PROMPT - v3 Optimize Edilmiş
// ═══════════════════════════════════════════════════════════════════════════

function buildClaudePrompt(tableInfo, pageTexts) {
  return `Sen bir KAMU İHALE UZMANISIN. Bu bir "MALZEMELİ YEMEK HİZMETİ" teknik şartnamesidir.

KİK Mevzuatına göre (Genel Tebliğ 79. madde, Ek-H.4) kritik alanları bul.

═══════════════════════════════════════════════════════════════════════════════
TABLOLAR - Tablo indeksini ve sayfayı belirt
═══════════════════════════════════════════════════════════════════════════════

🔴 KRİTİK (ZORUNLU):
- haftalik_menu_1: 1. Hafta Menüsü (en az 2 hafta ZORUNLU)
- haftalik_menu_2: 2. Hafta Menüsü  
- gramaj_tablosu: Gramaj/Porsiyon/Çiğ Girdi (aşırı düşük teklif için ZORUNLU)
- personel_tablosu: Çalışacak personel listesi (işçilik maliyeti için)
- birim_fiyat_cetveli: Birim fiyat teklif cetveli

🟡 ÖNEMLİ:
- haftalik_menu_3: 3. Hafta Menüsü (varsa)
- haftalik_menu_4: 4. Hafta Menüsü (varsa)
- ornek_menu: Hafta belirtilmemiş genel menü
- yemek_gruplari: "Birinci Grup: Çorba", "İkinci Grup: Ana Yemek" tablosu
- ogun_dagilimi: Kahvaltı/Öğle/Akşam öğün dağılımı
- malzeme_listesi: Hammadde/malzeme listesi
- ekipman_listesi: Mutfak ekipmanları
- dagitim_noktalari: Yemekhaneler/servis noktaları
- ceza_kesintileri: Ceza/kesinti tablosu
- kalite_standartlari: Kalite gereksinimleri

═══════════════════════════════════════════════════════════════════════════════
STRING ALANLAR - Değeri ve sayfayı belirt
═══════════════════════════════════════════════════════════════════════════════

🔴 KRİTİK:
- ihale_konusu: İhalenin konusu/adı
- ihale_kayit_no: İKN (örn: 2024/123456)
- idare_adi: İhaleyi yapan kurum
- gunluk_kisi_sayisi: Günlük yemek yiyecek kişi sayısı
- isci_sayisi: Çalıştırılacak işçi sayısı
- ogun_sayisi: Günlük öğün sayısı
- sozlesme_suresi: Sözleşme süresi (ay/gün)
- hizmet_gun_sayisi: Toplam hizmet gün sayısı
- iscilik_orani: İşçilik oranı (%)

🟡 ÖNEMLİ:
- toplam_kisi_sayisi: Toplam kişi sayısı
- yemek_cesit_sayisi: Öğün başına çeşit (örn: "4 çeşit yemek")
- ise_baslama_tarihi: İşe başlama tarihi
- is_bitis_tarihi: İş bitiş tarihi
- yaklasik_maliyet: Yaklaşık maliyet tutarı
- ogun_basi_fiyat: Öğün başı birim fiyat
- mutfak_tipi: yerinde/taşımalı/merkezi
- servis_tipi: benmari/self servis/tabldot
- servis_saati: Servis saati (örn: 12:30)
- teslim_yeri: Yemek teslim yeri
- et_tipi: dana/tavuk/karışık
- kahvalti_var: Kahvaltı var mı? (evet/hayır)
- ara_ogun_var: Ara öğün var mı?
- gece_yemegi_var: Gece yemeği var mı?
- diyet_menu_var: Diyet menü var mı?
- ekmek_dahil: Ekmek dahil mi?

═══════════════════════════════════════════════════════════════════════════════
MEVCUT TABLOLAR
═══════════════════════════════════════════════════════════════════════════════
${JSON.stringify(tableInfo, null, 2)}

═══════════════════════════════════════════════════════════════════════════════
SAYFA METİNLERİ
═══════════════════════════════════════════════════════════════════════════════
${Object.entries(pageTexts).map(([num, text]) => `\n--- SAYFA ${num} ---\n${text.substring(0, 4000)}`).join('\n')}

═══════════════════════════════════════════════════════════════════════════════
ÇIKTI FORMATI - JSON
═══════════════════════════════════════════════════════════════════════════════

{
  "tables": [
    {"field": "haftalik_menu_1", "page": 1, "tableIndex": 0, "confidence": "high"},
    {"field": "gramaj_tablosu", "page": 3, "tableIndex": 2, "confidence": "medium"}
  ],
  "strings": [
    {"field": "ihale_konusu", "page": 1, "value": "Malzemeli Yemek Hizmeti Alımı", "confidence": "high"},
    {"field": "gunluk_kisi_sayisi", "page": 1, "value": "500", "confidence": "high"},
    {"field": "kahvalti_var", "page": 2, "value": "evet", "confidence": "medium"}
  ]
}

KURALLAR:
1. Sadece BULDUĞUN alanları listele
2. confidence: high (kesin), medium (muhtemel), low (belirsiz)
3. Boolean alanlar için value: "evet" veya "hayır"
4. Sayılar için sadece rakam yaz (birim olmadan)
5. Tarihler için GG.AA.YYYY formatı kullan`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANA FONKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════

// Azure clients
const docClient = new DocumentAnalysisClient(CONFIG.azure.endpoint, new AzureKeyCredential(CONFIG.azure.key));
const sharedKeyCredential = new StorageSharedKeyCredential(CONFIG.storage.account, CONFIG.storage.key);
const blobService = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${CONFIG.storage.account};AccountKey=${CONFIG.storage.key};EndpointSuffix=core.windows.net`
);
const containerClient = blobService.getContainerClient(CONFIG.storage.container);
const anthropic = new Anthropic({ apiKey: CONFIG.anthropic.key });

function getBlobSasUrl(blobName) {
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: CONFIG.storage.container,
      blobName: blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + 60 * 60 * 1000),
    },
    sharedKeyCredential
  ).toString();
  return `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}/${encodeURIComponent(blobName)}?${sasToken}`;
}

async function analyzeWithClaude(pdfBase64, layoutResult) {
  // Sayfa metinlerini hazırla
  const pageTexts = {};
  if (layoutResult.pages) {
    for (const page of layoutResult.pages) {
      const text = page.lines?.map(l => l.content).join('\n') || '';
      pageTexts[page.pageNumber] = text;
    }
  }

  // Tablo bilgilerini hazırla
  const tableInfo = [];
  if (layoutResult.tables) {
    for (let i = 0; i < layoutResult.tables.length; i++) {
      const table = layoutResult.tables[i];
      const headerCells = table.cells?.filter(c => c.rowIndex === 0) || [];
      const headers = headerCells.map(c => c.content).join(' | ');
      const pageNum = table.boundingRegions?.[0]?.pageNumber || 1;
      
      // İlk satır örneği
      const firstRowCells = table.cells?.filter(c => c.rowIndex === 1) || [];
      const firstRow = firstRowCells.map(c => c.content).join(' | ');
      
      tableInfo.push({
        index: i,
        page: pageNum,
        rows: table.rowCount,
        cols: table.columnCount,
        headers: headers.substring(0, 200),
        firstRow: firstRow.substring(0, 150),
      });
    }
  }

  const prompt = buildClaudePrompt(tableInfo, pageTexts);

  try {
    const response = await anthropic.messages.create({
      model: CONFIG.anthropic.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { tables: [], strings: [] };
  } catch (error) {
    console.log(`   ⚠️  Claude hatası: ${error.message}`);
    return { tables: [], strings: [] };
  }
}

function createLabels(layoutResult, claudeAnalysis) {
  const labels = [];

  // Tablo etiketleri
  if (claudeAnalysis.tables) {
    for (const match of claudeAnalysis.tables) {
      if (match.confidence === 'low') continue;
      
      const table = layoutResult.tables?.[match.tableIndex];
      if (table && table.boundingRegions?.[0]) {
        const region = table.boundingRegions[0];
        labels.push({
          label: match.field,
          labelType: 'table',
          value: [{
            pageNumber: region.pageNumber,
            boundingBox: polygonToBox(region.polygon),
            tableIndex: match.tableIndex,
          }],
        });
      }
    }
  }

  // String etiketleri
  if (claudeAnalysis.strings) {
    for (const match of claudeAnalysis.strings) {
      if (match.confidence === 'low') continue;
      
      const page = layoutResult.pages?.find(p => p.pageNumber === match.page);
      let foundLine = null;
      
      if (page?.lines && match.value) {
        const searchValue = String(match.value).toLowerCase().substring(0, 30);
        for (const line of page.lines) {
          if (line.content.toLowerCase().includes(searchValue)) {
            foundLine = line;
            break;
          }
        }
      }

      if (foundLine?.polygon) {
        labels.push({
          label: match.field,
          value: [{
            pageNumber: match.page,
            boundingBox: polygonToBox(foundLine.polygon),
            text: String(match.value),
          }],
        });
      } else {
        labels.push({
          label: match.field,
          value: [{
            pageNumber: match.page,
            text: String(match.value),
          }],
        });
      }
    }
  }

  return labels;
}

function polygonToBox(polygon) {
  if (!polygon || polygon.length < 4) return null;
  const xs = polygon.filter((_, i) => i % 2 === 0);
  const ys = polygon.filter((_, i) => i % 2 === 1);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return [left, top, right - left, bottom - top];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║     SMART LABEL v3 - KİK Mevzuatına Uygun Kapsamlı Etiketleme           ║');
  console.log('║     Kaynak: KİK Genel Tebliği 79. madde, Ek-H.4                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  // Kritik alan sayısı
  const criticalTables = Object.entries(FIELD_DEFINITIONS.tables).filter(([_, v]) => v.critical).length;
  const criticalStrings = Object.entries(FIELD_DEFINITIONS.strings).filter(([_, v]) => v.critical).length;
  console.log(`📋 Tanımlı Alanlar: ${Object.keys(FIELD_DEFINITIONS.tables).length} tablo, ${Object.keys(FIELD_DEFINITIONS.strings).length} string`);
  console.log(`🔴 Kritik Alanlar: ${criticalTables} tablo, ${criticalStrings} string\n`);

  // PDF'leri listele
  const pdfs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) {
      pdfs.push(blob.name);
    }
  }

  console.log(`📄 ${pdfs.length} PDF bulundu\n`);

  let processed = 0;
  let errors = 0;
  let totalLabels = 0;
  const stats = { tables: {}, strings: {} };

  for (const pdfName of pdfs) {
    processed++;
    console.log(`\n${'═'.repeat(76)}`);
    console.log(`[${processed}/${pdfs.length}] ${pdfName.substring(0, 60)}...`);

    try {
      // 1. Azure Layout analizi
      console.log('   📊 Azure Layout analizi...');
      const blobSasUrl = getBlobSasUrl(pdfName);
      const poller = await docClient.beginAnalyzeDocumentFromUrl('prebuilt-layout', blobSasUrl);
      const layoutResult = await poller.pollUntilDone();

      // 2. PDF indir
      console.log('   📥 PDF indiriliyor...');
      const blobClient = containerClient.getBlobClient(pdfName);
      const downloadResponse = await blobClient.download();
      const chunks = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(chunk);
      }

      // 3. Claude analizi
      console.log('   🤖 Claude v3 analizi...');
      const claudeAnalysis = await analyzeWithClaude(Buffer.concat(chunks), layoutResult);

      // 4. Label oluştur
      console.log('   🏷️  Label oluşturuluyor...');
      const labels = createLabels(layoutResult, claudeAnalysis);

      if (labels.length === 0) {
        console.log('   ⚠️  Etiketlenecek alan bulunamadı');
        continue;
      }

      // 5. Label kaydet
      const labelFileName = pdfName + '.labels.json';
      const labelData = { document: pdfName, labels };
      const labelContent = JSON.stringify(labelData, null, 2);
      const labelBlobClient = containerClient.getBlockBlobClient(labelFileName);
      await labelBlobClient.upload(labelContent, labelContent.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' },
      });

      // İstatistikler
      totalLabels += labels.length;
      const tableLabels = labels.filter(l => l.labelType === 'table');
      const stringLabels = labels.filter(l => l.labelType !== 'table');
      
      tableLabels.forEach(l => {
        stats.tables[l.label] = (stats.tables[l.label] || 0) + 1;
      });
      stringLabels.forEach(l => {
        stats.strings[l.label] = (stats.strings[l.label] || 0) + 1;
      });

      console.log(`   ✅ ${labels.length} etiket kaydedildi`);
      console.log(`      📊 Tablolar (${tableLabels.length}): ${[...new Set(tableLabels.map(l => l.label))].join(', ') || '-'}`);
      console.log(`      📝 Alanlar (${stringLabels.length}): ${[...new Set(stringLabels.map(l => l.label))].join(', ') || '-'}`);

    } catch (error) {
      errors++;
      console.log(`   ❌ Hata: ${error.message}`);
    }

    // Rate limiting
    await sleep(2000);
  }

  // Özet
  console.log(`\n${'═'.repeat(76)}`);
  console.log('📊 ÖZET İSTATİSTİKLER');
  console.log(`${'═'.repeat(76)}`);
  console.log(`✅ Başarılı: ${processed - errors}/${processed}`);
  console.log(`❌ Hata: ${errors}`);
  console.log(`🏷️  Toplam Etiket: ${totalLabels}`);
  
  console.log('\n📊 TABLO ETİKETLERİ:');
  Object.entries(stats.tables).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const def = FIELD_DEFINITIONS.tables[k];
    const critical = def?.critical ? '🔴' : '  ';
    console.log(`   ${critical} ${k}: ${v} dosyada`);
  });
  
  console.log('\n📝 STRING ETİKETLERİ:');
  Object.entries(stats.strings).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    const def = FIELD_DEFINITIONS.strings[k];
    const critical = def?.critical ? '🔴' : '  ';
    console.log(`   ${critical} ${k}: ${v} dosyada`);
  });
}

main().catch(console.error);
