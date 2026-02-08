#!/usr/bin/env node

/**
 * BUILD DATASET - URL + Lokal PDF Otomatik Azure Training Dataset Oluşturucu
 * 
 * Web'deki PDF URL'lerinden VEYA lokal PDF dosyalarından Azure DI Custom Model
 * eğitim dataseti oluşturur.
 * 
 * Pipeline (URL modu):
 *   1. PDF URL → Azure Layout API (urlSource) → OCR sonucu
 *   2. PDF URL → Blob Storage'a stream (locale inmez)
 *   3. OCR sonucu → .ocr.json olarak blob'a yükle
 *   4. Claude ile otomatik etiketleme → .labels.json (koordinatlar [0,1] normalize)
 *   5. fields.json yükle
 * 
 * Pipeline (Lokal mod):
 *   1. Lokal PDF → Blob Storage'a yükle
 *   2. SAS URL oluştur → Azure Layout API (urlSource) → OCR sonucu
 *   3. OCR sonucu → .ocr.json olarak blob'a yükle
 *   4. Claude ile otomatik etiketleme → .labels.json (koordinatlar [0,1] normalize)
 *   5. fields.json yükle
 * 
 * Kullanım:
 *   node build-dataset.mjs                              # Tüm URL'leri işle
 *   node build-dataset.mjs --local ./augmented/batch    # Lokal PDF klasörü
 *   node build-dataset.mjs --dry-run                    # Sadece listeyi göster
 *   node build-dataset.mjs --clean                      # Önce blob'u temizle
 *   node build-dataset.mjs --train                      # İşlem sonunda model eğit
 *   node build-dataset.mjs --train-only                 # Sadece model eğit (dataset zaten hazır)
 *   node build-dataset.mjs --local ./augmented/batch --clean --train --model=ihale-catering-v5
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { StorageSharedKeyCredential, generateAccountSASQueryParameters, AccountSASPermissions, AccountSASResourceTypes, AccountSASServices, SASProtocol } from '@azure/storage-blob';
import Anthropic from '@anthropic-ai/sdk';
import { CONFIG, sleep, log } from './config.mjs';
import fs from 'node:fs';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════
// PDF URL LİSTESİ - Çeşitli kurum türlerinden teknik şartnameler
// ═══════════════════════════════════════════════════════════════════════════

const PDF_URLS = [
  // ═══ SİSTEMDEKİ GERÇEK İHALE PDF'LERİ (Supabase Storage) ═══

  // ── Hastane ──
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/11231/tech_spec/1770109603751-f120a4f4-24_Aylik_Malzeme_Dahil_Yemek_Hizmeti_Alimi_Teknik_Sartnamesi.pdf.pdf',
    name: 'hastane_fsm_24aylik_yemek.pdf',
    category: 'hastane',
  },
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/29854/tech_spec/1770455099526-46b08d8d-33_AYLIK_YEMEK_HIZMET_ALIMI_TEKNIK_SARTNAMESI.pdf.pdf',
    name: 'hastane_afyon_33aylik_tasimali.pdf',
    category: 'hastane',
  },

  // ── Emniyet / Güvenlik ──
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/95/tech_spec/1770455503950-7f0c8498-TEKNIK_SARTNAME.pdf.pdf',
    name: 'emniyet_polis_akademisi_kirikkale.pdf',
    category: 'emniyet',
  },
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/18389/tech_spec/1770456143823-cd895978-2._Kisim_Odemis_Ilce_Emniyet_Teknik_Sartname_ve_ekleri.pdf.pdf',
    name: 'emniyet_izmir_odemis.pdf',
    category: 'emniyet',
  },
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/31002/tech_spec/1770454758655-dcaa708b-OZEL_HAREKAT_TEKNIK_SARTNAME.PDF.pdf',
    name: 'emniyet_mugla_ozel_harekat.pdf',
    category: 'emniyet',
  },
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/289/tech_spec/1770364574309-e48a6e44-CEVIK_KUVVET_IASE_TEKNIK_SARTNAME.pdf.pdf',
    name: 'emniyet_sanliurfa_cevik_kuvvet.pdf',
    category: 'emniyet',
  },

  // ── Spor / Gençlik ──
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/9175/tech_spec/1770455269552-f65d8c3b-Gida_ve_temizlik_malzemelerine_ait_teknik_sartname.pdf.pdf',
    name: 'spor_bursa_gida_teknik.pdf',
    category: 'spor',
  },
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/9175/tech_spec/1770455260535-03823794-Gramajlar_ve_ornek_menu.pdf.pdf',
    name: 'spor_bursa_gramaj_menu.pdf',
    category: 'spor',
  },

  // ── Demiryolu / Ulaşım ──
  {
    url: 'https://vpobejfxqihvgsjwnyku.supabase.co/storage/v1/object/public/tender-documents/tenders/16741/tech_spec/1770454713901-e0459bb4-TEKNIK_SARTNAME.pdf.pdf',
    name: 'tcdd_2bolge_yemek.pdf',
    category: 'ulasim',
  },
];

// Mevcut kısa PDF'ler de korunacak (8 sayfa, 5 sayfa olanlar storage'dan)
const KEEP_EXISTING_SHORT = true;
const MAX_EXISTING_PAGES = 10; // Bu sayfa sayısından kısa olanları koru

// ═══════════════════════════════════════════════════════════════════════════
// AZURE CLIENTS
// ═══════════════════════════════════════════════════════════════════════════

const blobService = BlobServiceClient.fromConnectionString(CONFIG.storage.connectionString);
const container = blobService.getContainerClient(CONFIG.storage.container);
const anthropic = new Anthropic({ apiKey: CONFIG.anthropic.key });

// ═══════════════════════════════════════════════════════════════════════════
// FIELDS.JSON - Azure DI Studio alan tanımları
// ═══════════════════════════════════════════════════════════════════════════

const FIELDS_JSON = {
  $schema: 'https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/fields.json',
  fields: [
    // ═══ İHALE GENEL BİLGİLERİ ═══
    { fieldKey: 'ihale_konusu', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'idare_adi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'ihale_kayit_no', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'ise_baslama_tarihi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'is_bitis_tarihi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'sure', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'yaklasik_maliyet', fieldType: 'string', fieldFormat: 'not-specified' },

    // ═══ CATERİNG OPERASYONEL BİLGİLER ═══
    { fieldKey: 'mutfak_tipi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'servis_tipi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'et_tipi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'gunluk_toplam_ogun', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'yemek_cesit_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'toplam_personel_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'ogle_kisi_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'kahvalti_kisi_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'aksam_kisi_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'diyet_kisi_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'hizmet_gun_sayisi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'kalite_standartlari', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'iscilik_orani', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'yemek_pisirilecek_yer', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'dagitim_saatleri', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'gida_guvenligi_belgeleri', fieldType: 'string', fieldFormat: 'not-specified' },

    // ═══ TABLOLAR ═══
    { fieldKey: 'menu_tablosu', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'gramaj_tablosu', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'personel_tablosu', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'ogun_dagilimi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'birim_fiyat_cetveli', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'malzeme_listesi', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'dagitim_noktalari', fieldType: 'string', fieldFormat: 'not-specified' },
    { fieldKey: 'ekipman_listesi', fieldType: 'string', fieldFormat: 'not-specified' },
  ],
  definitions: {},
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. URL'den Azure Layout API ile OCR
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeWithUrl(pdfUrl) {
  const analyzeUrl = `${CONFIG.azure.endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`;
  
  const resp = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': CONFIG.azure.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urlSource: pdfUrl }),
  });

  if (!resp.ok) {
    // URL çalışmazsa, PDF'i önce blob'a yükleyip SAS URL ile dene
    const errText = await resp.text();
    throw new Error(`Layout API hata (${resp.status}): ${errText.substring(0, 200)}`);
  }

  const operationUrl = resp.headers.get('operation-location');
  if (!operationUrl) throw new Error('Operation-Location header yok');

  // Poll until done
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const statusResp = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': CONFIG.azure.key },
    });
    const status = await statusResp.json();
    
    if (status.status === 'succeeded') {
      return status.analyzeResult;
    }
    if (status.status === 'failed') {
      throw new Error(`Layout analizi başarısız: ${JSON.stringify(status.error)}`);
    }
  }
  throw new Error('Layout analizi zaman aşımı');
}

/**
 * Fallback: PDF'i blob'a yükle, sonra SAS URL ile analiz et
 */
async function analyzeWithBlob(pdfName) {
  const sharedKeyCred = new StorageSharedKeyCredential(CONFIG.storage.account, CONFIG.storage.key);
  const sasToken = generateAccountSASQueryParameters({
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 3600000),
    services: AccountSASServices.parse('b').toString(),
    resourceTypes: AccountSASResourceTypes.parse('sco').toString(),
    permissions: AccountSASPermissions.parse('r'),
    protocol: SASProtocol.Https,
  }, sharedKeyCred).toString();

  const blobUrl = `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}/${pdfName}?${sasToken}`;
  return analyzeWithUrl(blobUrl);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2a. PDF'i URL'den Blob'a Stream
// ═══════════════════════════════════════════════════════════════════════════

async function streamPdfToBlob(pdfUrl, blobName) {
  const resp = await fetch(pdfUrl);
  if (!resp.ok) throw new Error(`PDF indirilemedi (${resp.status}): ${pdfUrl}`);
  
  const contentLength = parseInt(resp.headers.get('content-length') || '0');
  const blockClient = container.getBlockBlobClient(blobName);
  
  // Body'yi buffer'a çevir ve yükle
  const buffer = Buffer.from(await resp.arrayBuffer());
  await blockClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' },
  });
  
  return { size: buffer.length, pages: null }; // sayfa sayısı OCR'dan gelecek
}

// ═══════════════════════════════════════════════════════════════════════════
// 2b. Lokal PDF'i Blob'a Yükle
// ═══════════════════════════════════════════════════════════════════════════

async function uploadLocalPdfToBlob(localPath, blobName) {
  const buffer = fs.readFileSync(localPath);
  const blockClient = container.getBlockBlobClient(blobName);
  
  await blockClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: 'application/pdf' },
  });
  
  return { size: buffer.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2c. Blob SAS URL Oluştur (Layout API için)
// ═══════════════════════════════════════════════════════════════════════════

function generateBlobSasUrl(blobName) {
  const sharedKeyCred = new StorageSharedKeyCredential(CONFIG.storage.account, CONFIG.storage.key);
  const sasToken = generateAccountSASQueryParameters({
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 3600000), // 1 saat
    services: AccountSASServices.parse('b').toString(),
    resourceTypes: AccountSASResourceTypes.parse('sco').toString(),
    permissions: AccountSASPermissions.parse('r'),
    protocol: SASProtocol.Https,
  }, sharedKeyCred).toString();

  return `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}/${blobName}?${sasToken}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2d. Lokal Klasördeki PDF'leri Tara
// ═══════════════════════════════════════════════════════════════════════════

function scanLocalPdfs(folderPath) {
  const absPath = path.resolve(folderPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Klasör bulunamadı: ${absPath}`);
  }
  
  const files = fs.readdirSync(absPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort()
    .map(f => ({
      name: f,           // blob adı olarak da kullanılacak
      localPath: path.join(absPath, f),
      size: fs.statSync(path.join(absPath, f)).size,
    }));
  
  return files;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. OCR Sonucunu Blob'a Yükle
// ═══════════════════════════════════════════════════════════════════════════

async function uploadOcr(pdfName, analyzeResult) {
  const ocrName = `${pdfName}.ocr.json`;
  // Azure DI Training expects: status=succeeded + analyzeResult wrapper
  const ocrData = JSON.stringify({
    status: 'succeeded',
    createdDateTime: new Date().toISOString(),
    lastUpdatedDateTime: new Date().toISOString(),
    analyzeResult,
  }, null, 2);
  const blockClient = container.getBlockBlobClient(ocrName);
  await blockClient.upload(ocrData, Buffer.byteLength(ocrData), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
  return ocrName;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Claude ile Eksiksiz Etiketleme (Multi-Chunk - Tüm Sayfalar)
// ═══════════════════════════════════════════════════════════════════════════

const PAGES_PER_CHUNK = 15;

/**
 * Tabloların TAM metnini oluşturur - satır limiti yok
 */
function buildTableText(tables) {
  let text = '';
  for (const t of tables) {
    const pg = t.boundingRegions?.[0]?.pageNumber || '?';
    const rows = {};
    for (const cell of (t.cells || [])) {
      if (!rows[cell.rowIndex]) rows[cell.rowIndex] = [];
      rows[cell.rowIndex][cell.columnIndex] = cell.content || '';
    }
    const rowTexts = Object.entries(rows)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, cols]) => cols.join(' | '));
    text += `\n═══ TABLO (Sayfa ${pg}, ${t.rowCount}x${t.columnCount}) ═══\n`;
    text += rowTexts.join('\n') + '\n';
  }
  return text;
}

/**
 * Tek bir chunk için Claude'a gönderir
 */
async function labelChunk(pageText, tableText, startPage, endPage, totalPages) {
  const prompt = `Sen catering/yemek hizmeti ihale teknik şartnamesi uzmanısın.
Bu dokümanın ${startPage}-${endPage}. sayfalarını analiz ediyorsun (toplam ${totalPages} sayfa).
Aşağıdaki alanlardan bu sayfalarda bulunanları çıkar.

DOKÜMAN METNİ (Sayfa ${startPage}-${endPage}):
${pageText}

TABLOLAR (bu sayfalardaki):
${tableText || '(bu bölümde tablo yok)'}

═══════════════════════════════════════════════════════
ÇIKARILACAK ALANLAR
═══════════════════════════════════════════════════════

─── İHALE GENEL BİLGİLERİ ───
- ihale_konusu: İhalenin konusu/adı (örn: "24 Aylık Malzeme Dahil Yemek Hizmeti Alımı")
- idare_adi: İhaleyi yapan kurum TAM adı (örn: "T.C. Sağlık Bakanlığı İstanbul İl Sağlık Müdürlüğü")
- ihale_kayit_no: İhale Kayıt Numarası / IKN (örn: "2025/123456")
- ise_baslama_tarihi: İşe başlama tarihi (GG.AA.YYYY - örn: "01.01.2025")
- is_bitis_tarihi: İş bitiş tarihi (GG.AA.YYYY - örn: "31.12.2025")
- sure: Sözleşme süresi (örn: "12 ay", "24 aylık", "365 takvim günü")
- yaklasik_maliyet: Yaklaşık maliyet tutarı (TL cinsinden, varsa)

─── CATERİNG OPERASYONEL BİLGİLER ───
- mutfak_tipi: "yerinde pişirme" / "taşımalı" / "hazır yemek" / "yerinde pişirme ve taşımalı"
- servis_tipi: "self servis" / "masaya servis" / "tabldot" / "kumanya" / "paket servis"
- et_tipi: Kullanılacak et türü - "dana" / "büyükbaş" / "küçükbaş" / "tavuk/kanatlı" / "karışık"
    (metinde geçen: "dana eti", "koyun eti", "büyükbaş hayvan eti", "kanatlı" vb.)
- gunluk_toplam_ogun: Günlük toplam öğün sayısı (örn: "3 öğün", "4 öğün - kahvaltı, öğle, akşam, gece")
- yemek_cesit_sayisi: Bir öğünde kaç çeşit yemek verileceği (örn: "4 çeşit", "5 kap")
- toplam_personel_sayisi: Yüklenicinin çalıştıracağı toplam personel sayısı (tüm pozisyonlar)
- ogle_kisi_sayisi: Günlük/aylık öğle yemeği kişi veya porsiyon sayısı
- kahvalti_kisi_sayisi: Günlük/aylık kahvaltı kişi veya porsiyon sayısı
- aksam_kisi_sayisi: Günlük/aylık akşam yemeği kişi veya porsiyon sayısı
- diyet_kisi_sayisi: Günlük/aylık diyet yemek porsiyon sayısı
- hizmet_gun_sayisi: Toplam hizmet gün sayısı (örn: "365 gün", "250 iş günü")
- kalite_standartlari: Gerekli kalite belgeleri (ISO 9001, ISO 22000, ISO 14001, HACCP, TSE vb.)
- iscilik_orani: İşçilik oranı yüzdesi (örn: "%35", "yüzde otuz beş")
- yemek_pisirilecek_yer: Mutfak/pişirme tesisi yeri veya tanımı
- dagitim_saatleri: Yemek dağıtım/servis saatleri (örn: "Kahvaltı 07:00-08:30, Öğle 11:30-13:00")
- gida_guvenligi_belgeleri: Gerekli gıda güvenliği belgeleri (İşyeri Açma Ruhsatı, Gıda Üretim İzni vb.)

─── TABLO ALANLARI (tablonun başlık satırını value olarak ver) ───
- menu_tablosu: Haftalık/günlük yemek menüsü tablosu
    İPUCU: çorba, ana yemek, pilav, makarna, salata, tatlı, meyve, yoğurt isimleri içerir
    İPUCU: pazartesi/salı/çarşamba veya 1.gün/2.gün başlıkları olabilir
- gramaj_tablosu: Gramaj/porsiyon miktarları tablosu
    İPUCU: "gr", "gram", "porsiyon", "100 gr", "150 gr" gibi ağırlık değerleri içerir
    İPUCU: yemek adları satırlarda, gram miktarları sütunlarda olur
- personel_tablosu: Personel listesi/gereksinimleri tablosu
    İPUCU: aşçıbaşı, aşçı, garson, bulaşıkçı, diyetisyen, gıda mühendisi, servis elemanı
- ogun_dagilimi: Öğün dağılım tablosu (kurum/birim bazında kahvaltı/öğle/akşam sayıları)
    İPUCU: birim/bina adları satırlarda, öğün türleri sütunlarda, sayılar hücrelerde
- birim_fiyat_cetveli: Birim fiyat teklif cetveli
    İPUCU: kalem adı, birim, miktar, birim fiyat, toplam tutar sütunları
- malzeme_listesi: Hammadde/gıda malzeme listesi tablosu
    İPUCU: gıda maddeleri, miktarlar, birimler (kg, lt, adet)
- dagitim_noktalari: Dağıtım/servis noktaları tablosu
    İPUCU: bina/kat/birim adları, kapasite, mesafe bilgileri
- ekipman_listesi: Mutfak ekipman/demirbaş listesi tablosu
    İPUCU: ekipman adı, adet, kapasite (endüstriyel fırın, bulaşık makinesi vb.)

═══════════════════════════════════════════════════════
KURALLAR
═══════════════════════════════════════════════════════
1. SADECE bu sayfalarda (${startPage}-${endPage}) bulunan bilgileri döndür
2. Tahmin yapma, uydurma - metinde YOKSA dahil etme
3. Her alan için SAYFA NUMARASINI belirt
4. Değeri metindeki ORİJİNAL ifade ile ver (kısaltma yapma)
5. Tablo alanları için tablonun BAŞLIK (ilk) satırını value olarak ver
6. Aynı alan birden fazla yerde varsa en detaylı/kapsamlı olanı seç

JSON formatı (SADECE JSON döndür):
{
  "fields": [
    {"field": "alan_adi", "value": "metindeki orijinal değer", "page": SAYFA_NO, "line_text": "değerin geçtiği satır"}
  ]
}`;

  const response = await anthropic.messages.create({
    model: CONFIG.anthropic.model,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];

  try {
    const result = JSON.parse(match[0]);
    return result.fields || [];
  } catch {
    let json = match[0].replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(json).fields || []; } catch { return []; }
  }
}

/**
 * Dokümanı chunk'lara böl, her chunk'ı Claude'a gönder, sonuçları birleştir.
 * Sayfa limiti YOK - 1000 sayfa bile olsa tamamı işlenir.
 */
async function labelDocument(pdfName, analyzeResult) {
  const pages = analyzeResult.pages || [];
  const tables = analyzeResult.tables || [];
  const totalPages = pages.length;

  log(`${totalPages} sayfa, ${tables.length} tablo → eksiksiz analiz`, 'info');

  const allFields = [];
  const seenFields = new Set();

  // Sayfa chunk'larını oluştur
  const chunks = [];
  for (let start = 0; start < totalPages; start += PAGES_PER_CHUNK) {
    chunks.push({ start: start + 1, end: Math.min(start + PAGES_PER_CHUNK, totalPages) });
  }

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    // Bu chunk'ın sayfa metinleri - TAM METİN, kırpma yok
    let pageText = '';
    for (let pn = chunk.start; pn <= chunk.end; pn++) {
      const page = pages.find(p => p.pageNumber === pn);
      if (!page) continue;
      pageText += `\n--- SAYFA ${pn} ---\n`;
      pageText += (page.lines?.map(l => l.content).join('\n') || '') + '\n';
    }

    // Bu chunk'taki tablolar - TÜM satırlar, kırpma yok
    const chunkTables = tables.filter(t => {
      const pg = t.boundingRegions?.[0]?.pageNumber;
      return pg && pg >= chunk.start && pg <= chunk.end;
    });

    // Boş chunk atla
    if (!pageText.trim() && chunkTables.length === 0) continue;

    const tableText = buildTableText(chunkTables);

    log(`  Chunk ${ci + 1}/${chunks.length} (Sayfa ${chunk.start}-${chunk.end}, ${chunkTables.length} tablo)`, 'info');

    try {
      const fields = await labelChunk(pageText, tableText, chunk.start, chunk.end, totalPages);

      for (const f of fields) {
        if (!seenFields.has(f.field)) {
          allFields.push(f);
          seenFields.add(f.field);
        }
      }

      if (fields.length > 0) {
        log(`    → ${fields.length} alan bulundu (toplam: ${allFields.length})`, 'success');
      }
    } catch (e) {
      log(`    Chunk ${ci + 1} hata: ${e.message}`, 'error');
    }

    // Rate limit - chunk'lar arası bekleme
    if (ci < chunks.length - 1) await sleep(1500);
  }

  return allFields;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Label Dosyası Oluştur (Koordinatlar [0,1] Normalize)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Türkçe karakter normalize (fuzzy arama için)
 */
function normalizeTR(text) {
  return text
    .toLowerCase()
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .replace(/Ş/g, 'ş').replace(/Ç/g, 'ç')
    .replace(/Ğ/g, 'ğ').replace(/Ü/g, 'ü').replace(/Ö/g, 'ö')
    .replace(/[^a-zçğıöşü0-9.,/\-:% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Polygon'u [0,1] aralığına normalize et
 */
function normalizePoly(polygon, dims) {
  return polygon.map((v, i) => {
    const normalized = i % 2 === 0 ? v / dims.width : v / dims.height;
    return parseFloat(Math.min(1, Math.max(0, normalized)).toFixed(6));
  });
}

/**
 * Metni sayfada bul - 3 aşamalı fuzzy match:
 *  1. Tam substring eşleşme
 *  2. İlk N kelime eşleşme
 *  3. Herhangi uzun kelime eşleşme
 */
function findBoundingBox(searchValue, lineText, lines, dims) {
  if (!lines?.length || !dims) return null;

  const needle = normalizeTR(String(searchValue)).substring(0, 60);
  if (!needle || needle.length < 3) return null;

  // 1. Tam substring
  for (const line of lines) {
    const hay = normalizeTR(line.content || '');
    if (hay.includes(needle) && line.polygon?.length >= 8) {
      return normalizePoly(line.polygon, dims);
    }
  }

  // 2. line_text ile dene
  if (lineText) {
    const lineNeedle = normalizeTR(String(lineText)).substring(0, 60);
    if (lineNeedle.length >= 5) {
      for (const line of lines) {
        const hay = normalizeTR(line.content || '');
        if (hay.includes(lineNeedle) && line.polygon?.length >= 8) {
          return normalizePoly(line.polygon, dims);
        }
      }
    }
  }

  // 3. İlk 4 kelime ile dene
  const words = needle.split(' ').filter(w => w.length > 2);
  const firstWords = words.slice(0, 4).join(' ');
  if (firstWords.length >= 6) {
    for (const line of lines) {
      const hay = normalizeTR(line.content || '');
      if (hay.includes(firstWords) && line.polygon?.length >= 8) {
        return normalizePoly(line.polygon, dims);
      }
    }
  }

  // 4. En uzun kelime ile dene (en az 5 karakter)
  const longWords = words.filter(w => w.length >= 5).sort((a, b) => b.length - a.length);
  for (const word of longWords.slice(0, 3)) {
    for (const line of lines) {
      const hay = normalizeTR(line.content || '');
      if (hay.includes(word) && line.polygon?.length >= 8) {
        return normalizePoly(line.polygon, dims);
      }
    }
  }

  return null;
}

/**
 * Tablo alanları için: Azure tablosunun bounding box'ını kullan
 */
function findTableBoundingBox(pageNum, fieldValue, tables, pageDims) {
  const dims = pageDims[pageNum];
  if (!dims) return null;

  // Bu sayfadaki tabloları bul
  const pageTables = (tables || []).filter(t =>
    t.boundingRegions?.[0]?.pageNumber === pageNum
  );

  if (pageTables.length === 0) return null;

  // Eğer sadece 1 tablo varsa direkt onu kullan
  if (pageTables.length === 1) {
    const poly = pageTables[0].boundingRegions[0].polygon;
    if (poly?.length >= 8) return normalizePoly(poly, dims);
  }

  // Birden fazla tablo varsa: header metnine en yakın olanı bul
  const needle = normalizeTR(String(fieldValue)).substring(0, 40);
  for (const table of pageTables) {
    const headerCells = (table.cells || []).filter(c => c.rowIndex === 0);
    const headerText = normalizeTR(headerCells.map(c => c.content || '').join(' '));
    if (headerText.includes(needle) || needle.includes(headerText.substring(0, 20))) {
      const poly = table.boundingRegions[0].polygon;
      if (poly?.length >= 8) return normalizePoly(poly, dims);
    }
  }

  // Fallback: en büyük tabloyu seç
  const biggest = pageTables.sort((a, b) =>
    ((b.rowCount || 0) * (b.columnCount || 0)) - ((a.rowCount || 0) * (a.columnCount || 0))
  )[0];
  const poly = biggest?.boundingRegions?.[0]?.polygon;
  if (poly?.length >= 8) return normalizePoly(poly, dims);

  return null;
}

// Tablo alan isimleri (koordinat eşleştirmede tablo bounding box kullanılır)
const TABLE_FIELDS = new Set([
  'menu_tablosu', 'gramaj_tablosu', 'personel_tablosu', 'ogun_dagilimi',
  'birim_fiyat_cetveli', 'malzeme_listesi', 'dagitim_noktalari', 'ekipman_listesi',
]);

function createNormalizedLabels(pdfName, analyzeResult, fields) {
  const pages = analyzeResult.pages || [];
  const tables = analyzeResult.tables || [];
  const pageDims = {};
  for (const p of pages) {
    pageDims[p.pageNumber] = { width: p.width, height: p.height };
  }

  const labels = [];

  for (const f of fields) {
    const pageNum = f.page || 1;
    const page = pages.find(p => p.pageNumber === pageNum);
    if (!page) continue;

    const dims = pageDims[pageNum];
    if (!dims) continue;

    let boundingBox = null;

    if (TABLE_FIELDS.has(f.field)) {
      // Tablo alanı → Azure tablosunun kendi bounding box'ını kullan
      boundingBox = findTableBoundingBox(pageNum, f.value, tables, pageDims);
    }

    if (!boundingBox) {
      // String alanı veya tablo bbox bulunamadıysa → metin satırında ara (fuzzy)
      boundingBox = findBoundingBox(f.value, f.line_text, page.lines, dims);
    }

    labels.push({
      label: f.field,
      key: null,
      value: [{
        page: pageNum,
        text: String(f.value),
        boundingBoxes: boundingBox ? [boundingBox] : [],
      }],
    });
  }

  // Koordinat istatistiği
  const withBox = labels.filter(l => l.value[0].boundingBoxes.length > 0).length;
  const total = labels.length;
  log(`Koordinat eşleşme: ${withBox}/${total} alan (${total > 0 ? Math.round(withBox / total * 100) : 0}%)`, 'info');

  return {
    $schema: 'https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json',
    document: pdfName,
    labels,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Model Eğitimi
// ═══════════════════════════════════════════════════════════════════════════

async function trainModel(modelId) {
  const sharedKeyCred = new StorageSharedKeyCredential(CONFIG.storage.account, CONFIG.storage.key);
  const sasToken = generateAccountSASQueryParameters({
    startsOn: new Date(),
    expiresOn: new Date(Date.now() + 24 * 3600000),
    services: AccountSASServices.parse('b').toString(),
    resourceTypes: AccountSASResourceTypes.parse('sco').toString(),
    permissions: AccountSASPermissions.parse('rl'),
    protocol: SASProtocol.Https,
  }, sharedKeyCred).toString();

  const containerUrl = `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}?${sasToken}`;

  // Eski modeli sil (varsa)
  try {
    await fetch(`${CONFIG.azure.endpoint}/documentintelligence/documentModels/${modelId}?api-version=2024-11-30`, {
      method: 'DELETE',
      headers: { 'Ocp-Apim-Subscription-Key': CONFIG.azure.key },
    });
    await sleep(2000);
  } catch {}

  const buildUrl = `${CONFIG.azure.endpoint}/documentintelligence/documentModels:build?api-version=2024-11-30`;
  const resp = await fetch(buildUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': CONFIG.azure.key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId,
      description: `ihale catering teknik sartname modeli - augmented + URL training data`,
      buildMode: 'neural',
      azureBlobSource: { containerUrl },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Model eğitimi başlatılamadı (${resp.status}): ${err}`);
  }

  const opUrl = resp.headers.get('operation-location');
  log(`Model eğitimi başladı: ${modelId}`, 'success');
  log(`Operation: ${opUrl}`, 'info');

  // Poll
  for (let i = 0; i < 120; i++) {
    await sleep(30000);
    const sr = await fetch(opUrl, { headers: { 'Ocp-Apim-Subscription-Key': CONFIG.azure.key } });
    const s = await sr.json();
    const ts = new Date().toLocaleTimeString('tr-TR');
    process.stdout.write(`\r   [${ts}] ${s.status} - ${s.percentCompleted || 0}%   `);

    if (s.status === 'succeeded') {
      console.log('\n');
      log('MODEL HAZIR!', 'success');
      const mr = await fetch(s.resourceLocation, { headers: { 'Ocp-Apim-Subscription-Key': CONFIG.azure.key } });
      const m = await mr.json();
      if (m.docTypes) {
        for (const [name, info] of Object.entries(m.docTypes)) {
          const fields = Object.keys(info.fieldSchema || {});
          log(`Tip: ${name} (${fields.length} alan)`, 'info');
          for (const f of fields.sort()) {
            const conf = info.fieldConfidence?.[f];
            console.log(`     ${conf ? (conf * 100).toFixed(0) + '%' : '?'} ${f}`);
          }
        }
      }
      return m;
    }
    if (s.status === 'failed') {
      console.log('\n');
      throw new Error(`Model eğitimi başarısız: ${JSON.stringify(s.error, null, 2)}`);
    }
  }
  throw new Error('Model eğitimi zaman aşımı (60 dk)');
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOB TEMİZLİK
// ═══════════════════════════════════════════════════════════════════════════

async function cleanBlob(keepShort) {
  log('Blob storage temizleniyor...', 'step');
  
  if (!keepShort) {
    // Her şeyi sil
    for await (const blob of container.listBlobsFlat()) {
      await container.deleteBlob(blob.name);
    }
    log('Tüm dosyalar silindi', 'success');
    return;
  }

  // Kısa PDF'leri ve ilgili dosyalarını koru
  const blobs = [];
  for await (const blob of container.listBlobsFlat()) {
    blobs.push(blob.name);
  }

  // OCR dosyalarından sayfa sayılarını öğren
  const shortPdfs = new Set();
  for (const name of blobs) {
    if (!name.endsWith('.ocr.json')) continue;
    try {
      const buf = await container.getBlobClient(name).downloadToBuffer();
      const ocr = JSON.parse(buf.toString());
      const pages = ocr.analyzeResult?.pages || ocr.pages || [];
      if (pages.length <= MAX_EXISTING_PAGES) {
        const pdfName = name.replace('.ocr.json', '');
        shortPdfs.add(pdfName);
      }
    } catch {}
  }

  log(`${shortPdfs.size} kısa PDF korunacak`, 'info');

  // Uzun PDF'leri ve ilgili dosyaları sil
  for (const name of blobs) {
    const baseName = name.replace('.ocr.json', '').replace('.labels.json', '');
    if (name === 'fields.json') continue;
    if (shortPdfs.has(baseName) || shortPdfs.has(name)) continue;
    
    // Yeni URL'lerden gelecek dosyalarla çakışma olmasın
    await container.deleteBlob(name);
  }
  log('Uzun PDF\'ler temizlendi', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// MEVCUT KISA PDF'LERİ YENİDEN ETİKETLE
// ═══════════════════════════════════════════════════════════════════════════

async function relabelExistingPdfs() {
  const blobs = [];
  for await (const blob of container.listBlobsFlat()) {
    blobs.push(blob.name);
  }
  
  const pdfs = blobs.filter(b => b.endsWith('.pdf'));
  const results = [];
  
  for (const pdfName of pdfs) {
    // URL'den gelen yeni PDF'leri atla (onlar zaten etiketlenecek)
    if (PDF_URLS.some(u => u.name === pdfName)) continue;
    
    const ocrFile = `${pdfName}.ocr.json`;
    if (!blobs.includes(ocrFile)) continue;
    
    try {
      const buf = await container.getBlobClient(ocrFile).downloadToBuffer();
      const ocr = JSON.parse(buf.toString());
      const analyzeResult = ocr.analyzeResult || ocr;
      
      log(`Mevcut PDF etiketleniyor: ${pdfName.substring(0, 50)}...`, 'step');
      const fields = await labelDocument(pdfName, analyzeResult);
      
      if (fields.length > 0) {
        const labelData = createNormalizedLabels(pdfName, analyzeResult, fields);
        const labelContent = JSON.stringify(labelData, null, 2);
        await container.getBlockBlobClient(`${pdfName}.labels.json`).upload(
          labelContent, Buffer.byteLength(labelContent),
          { blobHTTPHeaders: { blobContentType: 'application/json' } }
        );
        log(`${fields.length} alan etiketlendi`, 'success');
        results.push({ name: pdfName, fields: fields.length });
      }
    } catch (e) {
      log(`Hata: ${e.message}`, 'error');
    }
    await sleep(1000);
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOKAL PDF İŞLEME PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

async function processLocalPdfs(localFolder, { dryRun, clean, doTrain, modelId, skipExisting }) {
  const pdfFiles = scanLocalPdfs(localFolder);
  
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  BUILD DATASET - Lokal PDF Training Dataset                         ║');
  console.log('║  Local PDF → Blob → SAS URL → Layout API → Label → Train           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  log(`${pdfFiles.length} lokal PDF bulundu: ${localFolder}`, 'info');
  const totalSize = pdfFiles.reduce((s, f) => s + f.size, 0);
  log(`Toplam boyut: ${(totalSize / 1024 / 1024).toFixed(1)}MB`, 'info');

  if (dryRun) {
    for (const [i, f] of pdfFiles.entries()) {
      console.log(`  ${i + 1}. ${f.name} (${(f.size / 1024).toFixed(0)}KB)`);
    }
    console.log(`\n--dry-run: ${pdfFiles.length} dosya işlenmedi.`);
    return;
  }

  // Temizlik - lokal modda her şeyi sil (temiz başlangıç)
  if (clean) {
    await cleanBlob(false); // her şeyi sil
  }

  // fields.json yükle
  const fieldsContent = JSON.stringify(FIELDS_JSON, null, 2);
  await container.getBlockBlobClient('fields.json').upload(
    fieldsContent, Buffer.byteLength(fieldsContent),
    { blobHTTPHeaders: { blobContentType: 'application/json' } }
  );
  log('fields.json yüklendi', 'success');

  // Mevcut blob listesi (skip-existing kontrolü için)
  const existingBlobs = new Set();
  if (skipExisting) {
    for await (const blob of container.listBlobsFlat()) {
      existingBlobs.add(blob.name);
    }
    log(`Blob'da ${existingBlobs.size} mevcut dosya`, 'info');
  }

  let processed = 0, errors = 0, skipped = 0, totalFields = 0;
  const startTime = Date.now();

  // Önce skip edilecekleri filtrele
  const toProcess = [];
  for (const pdfFile of pdfFiles) {
    if (skipExisting) {
      const hasOcr = existingBlobs.has(`${pdfFile.name}.ocr.json`);
      const hasLabels = existingBlobs.has(`${pdfFile.name}.labels.json`);
      if (hasOcr && hasLabels) {
        skipped++;
        continue;
      }
    }
    toProcess.push(pdfFile);
  }
  
  if (skipped > 0) {
    log(`${skipped} dosya atlandı (mevcut), ${toProcess.length} dosya işlenecek`, 'info');
  }

  // ═══════════════════════════════════════════════════════════════════
  // PARALEL İŞLEME - Concurrency limiter
  // ═══════════════════════════════════════════════════════════════════
  const CONCURRENCY = 3;
  let activeCount = 0;
  let completedCount = 0;

  async function processOnePdf(pdfFile, index) {
    const tag = `[${index + 1}/${toProcess.length}]`;
    
    try {
      // 1. Lokal PDF'i blob'a yükle
      const { size } = await uploadLocalPdfToBlob(pdfFile.localPath, pdfFile.name);

      // 2. SAS URL oluştur ve Layout API ile OCR
      const sasUrl = generateBlobSasUrl(pdfFile.name);
      let analyzeResult;
      try {
        analyzeResult = await analyzeWithUrl(sasUrl);
      } catch (e) {
        errors++;
        console.log(`\n❌ ${tag} ${pdfFile.name} - Layout API hata: ${e.message.substring(0, 80)}`);
        return;
      }
      
      const pageCount = analyzeResult.pages?.length || 0;
      const tableCount = analyzeResult.tables?.length || 0;
      
      if (pageCount === 0) {
        errors++;
        console.log(`\n⚠️  ${tag} ${pdfFile.name} - OCR boş, atlanıyor`);
        return;
      }

      // 3. OCR yükle
      await uploadOcr(pdfFile.name, analyzeResult);

      // 4. Claude ile etiketleme
      const fields = await labelDocument(pdfFile.name, analyzeResult);

      // 5. Label dosyası oluştur ve yükle
      if (fields.length > 0) {
        const labelData = createNormalizedLabels(pdfFile.name, analyzeResult, fields);
        const labelContent = JSON.stringify(labelData, null, 2);
        await container.getBlockBlobClient(`${pdfFile.name}.labels.json`).upload(
          labelContent, Buffer.byteLength(labelContent),
          { blobHTTPHeaders: { blobContentType: 'application/json' } }
        );
        totalFields += fields.length;
        const fieldNames = fields.map(f => f.field).join(', ');
        console.log(`\n✅ ${tag} ${pdfFile.name} → ${fields.length} alan (${fieldNames})`);
      } else {
        const emptyLabel = {
          $schema: 'https://schema.cognitiveservices.azure.com/formrecognizer/2021-03-01/labels.json',
          document: pdfFile.name,
          labels: [],
        };
        const emptyContent = JSON.stringify(emptyLabel, null, 2);
        await container.getBlockBlobClient(`${pdfFile.name}.labels.json`).upload(
          emptyContent, Buffer.byteLength(emptyContent),
          { blobHTTPHeaders: { blobContentType: 'application/json' } }
        );
        console.log(`\n⚠️  ${tag} ${pdfFile.name} → 0 alan`);
      }
    } catch (e) {
      errors++;
      console.log(`\n❌ ${tag} ${pdfFile.name} - HATA: ${e.message.substring(0, 100)}`);
    } finally {
      completedCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = completedCount / ((Date.now() - startTime) / 1000);
      const remaining = Math.round((toProcess.length - completedCount) / rate);
      process.stdout.write(`\r⏳ ${completedCount}/${toProcess.length} tamamlandı | ${errors} hata | ${elapsed}s geçti | ~${remaining}s kaldı   `);
    }
  }

  // Semaphore tabanlı paralel çalıştırma
  log(`Paralel işleme başlıyor (${CONCURRENCY} eşzamanlı)...`, 'step');
  const queue = toProcess.map((pdf, i) => ({ pdf, index: i }));
  const workers = [];
  
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        await processOnePdf(item.pdf, item.index);
        await sleep(500); // Hafif rate limit
      }
    })());
  }

  await Promise.all(workers);
  processed = toProcess.length + skipped;

  // Doğrulama
  console.log(`\n${'═'.repeat(70)}`);
  log('Koordinat doğrulaması...', 'step');
  let badFiles = 0;
  for await (const blob of container.listBlobsFlat()) {
    if (!blob.name.endsWith('.labels.json')) continue;
    try {
      const buf = await container.getBlobClient(blob.name).downloadToBuffer();
      const labels = JSON.parse(buf.toString());
      for (const label of (labels.labels || [])) {
        for (const val of (label.value || [])) {
          for (const box of (val.boundingBoxes || [])) {
            if (box.length > 0 && Math.max(...box) > 1.0) {
              badFiles++;
              log(`KOORDİNAT HATASI: ${blob.name} - ${label.label}`, 'error');
              break;
            }
          }
        }
      }
    } catch {}
  }
  if (badFiles === 0) log('Tüm koordinatlar [0,1] aralığında', 'success');
  else log(`${badFiles} dosyada koordinat hatası!`, 'error');

  // Blob istatistikleri
  let blobPdfCount = 0, blobOcrCount = 0, blobLabelCount = 0;
  for await (const blob of container.listBlobsFlat()) {
    if (blob.name.endsWith('.pdf')) blobPdfCount++;
    else if (blob.name.endsWith('.ocr.json')) blobOcrCount++;
    else if (blob.name.endsWith('.labels.json')) blobLabelCount++;
  }

  // Özet
  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'═'.repeat(70)}`);
  console.log('OZET');
  console.log(`${'═'.repeat(70)}`);
  console.log(`Basarili: ${processed - errors - skipped}/${pdfFiles.length} PDF`);
  console.log(`Atlanan (mevcut): ${skipped}`);
  console.log(`Hata: ${errors}`);
  console.log(`Toplam alan: ${totalFields}`);
  console.log(`Koordinat hata: ${badFiles}`);
  console.log(`Blob: ${blobPdfCount} PDF, ${blobOcrCount} OCR, ${blobLabelCount} labels`);
  console.log(`Sure: ${totalElapsed} dakika`);

  // Model eğitimi
  if (doTrain && badFiles === 0) {
    console.log(`\n${'═'.repeat(70)}`);
    log(`Model egitimi baslatiliyor: ${modelId}`, 'step');
    await trainModel(modelId);
  } else if (doTrain && badFiles > 0) {
    log('Koordinat hatalari var, egitim atlandi!', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// URL MOD PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

async function processUrlPdfs({ dryRun, clean, doTrain, modelId }) {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  BUILD DATASET - URL\'den Otomatik Training Dataset                  ║');
  console.log('║  URL → Layout API → Blob → Label → Train                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  log(`${PDF_URLS.length} URL tanımlı`, 'info');
  if (dryRun) {
    for (const [i, u] of PDF_URLS.entries()) {
      console.log(`  ${i + 1}. [${u.category}] ${u.name}`);
      console.log(`     ${u.url.substring(0, 80)}...`);
    }
    console.log('\n--dry-run: işlem yapılmadı.');
    return;
  }

  // Temizlik
  if (clean) {
    await cleanBlob(KEEP_EXISTING_SHORT);
  }

  // fields.json yükle
  const fieldsContent = JSON.stringify(FIELDS_JSON, null, 2);
  await container.getBlockBlobClient('fields.json').upload(
    fieldsContent, Buffer.byteLength(fieldsContent),
    { blobHTTPHeaders: { blobContentType: 'application/json' } }
  );
  log('fields.json yüklendi', 'success');

  // Her URL için pipeline
  let processed = 0, errors = 0, totalFields = 0;
  
  for (const entry of PDF_URLS) {
    processed++;
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`[${processed}/${PDF_URLS.length}] ${entry.name} (${entry.category})`);

    try {
      // 1. PDF'i blob'a stream
      log('PDF blob\'a yükleniyor...', 'step');
      const { size } = await streamPdfToBlob(entry.url, entry.name);
      log(`${(size / 1024).toFixed(0)}KB yüklendi`, 'success');

      // 2. Layout API ile OCR (blob'dan SAS URL ile)
      log('Azure Layout API analizi...', 'step');
      let analyzeResult;
      try {
        // Önce URL ile dene
        analyzeResult = await analyzeWithUrl(entry.url);
      } catch {
        // URL çalışmazsa blob SAS ile dene
        log('URL ile analiz başarısız, blob SAS ile deneniyor...', 'warn');
        analyzeResult = await analyzeWithBlob(entry.name);
      }
      
      const pageCount = analyzeResult.pages?.length || 0;
      const tableCount = analyzeResult.tables?.length || 0;
      log(`${pageCount} sayfa, ${tableCount} tablo`, 'success');

      // 3. OCR yükle
      await uploadOcr(entry.name, analyzeResult);
      log('OCR yüklendi', 'success');

      // 4. Claude ile etiketleme
      log('Claude ile etiketleme...', 'step');
      const fields = await labelDocument(entry.name, analyzeResult);
      log(`${fields.length} alan bulundu`, 'success');

      // 5. Label dosyası oluştur ve yükle (normalize)
      if (fields.length > 0) {
        const labelData = createNormalizedLabels(entry.name, analyzeResult, fields);
        const labelContent = JSON.stringify(labelData, null, 2);
        await container.getBlockBlobClient(`${entry.name}.labels.json`).upload(
          labelContent, Buffer.byteLength(labelContent),
          { blobHTTPHeaders: { blobContentType: 'application/json' } }
        );
        totalFields += fields.length;
        log('Labels yüklendi (normalize)', 'success');

        // Bulunan alanları göster
        for (const f of fields) {
          console.log(`     ${f.field}: ${String(f.value).substring(0, 50)}`);
        }
      }
    } catch (e) {
      errors++;
      log(`HATA: ${e.message}`, 'error');
    }

    await sleep(2000); // Rate limit
  }

  // Mevcut kısa PDF'leri yeniden etiketle (koordinat normalize ile)
  if (KEEP_EXISTING_SHORT) {
    console.log(`\n${'═'.repeat(70)}`);
    log('Mevcut kısa PDF\'ler yeniden etiketleniyor...', 'step');
    const relabeled = await relabelExistingPdfs();
    log(`${relabeled.length} mevcut PDF yeniden etiketlendi`, 'success');
  }

  // Doğrulama: tüm label dosyalarının koordinatları [0,1] mi?
  console.log(`\n${'═'.repeat(70)}`);
  log('Koordinat doğrulaması...', 'step');
  let badFiles = 0;
  for await (const blob of container.listBlobsFlat()) {
    if (!blob.name.endsWith('.labels.json')) continue;
    const buf = await container.getBlobClient(blob.name).downloadToBuffer();
    const labels = JSON.parse(buf.toString());
    for (const label of (labels.labels || [])) {
      for (const val of (label.value || [])) {
        for (const box of (val.boundingBoxes || [])) {
          if (Math.max(...box) > 1.0) {
            badFiles++;
            log(`KOORDİNAT HATASI: ${blob.name} - ${label.label}`, 'error');
            break;
          }
        }
      }
    }
  }
  if (badFiles === 0) log('Tüm koordinatlar [0,1] aralığında', 'success');
  else log(`${badFiles} dosyada koordinat hatası!`, 'error');

  // Özet
  console.log(`\n${'═'.repeat(70)}`);
  console.log('OZET');
  console.log(`${'═'.repeat(70)}`);
  console.log(`Basarili: ${processed - errors}/${processed} URL`);
  console.log(`Toplam alan: ${totalFields}`);
  console.log(`Koordinat hata: ${badFiles}`);

  // Model eğitimi
  if (doTrain && badFiles === 0) {
    console.log(`\n${'═'.repeat(70)}`);
    log(`Model egitimi baslatiliyor: ${modelId}`, 'step');
    await trainModel(modelId);
  } else if (doTrain && badFiles > 0) {
    log('Koordinat hatalari var, egitim atlandi!', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const clean = args.includes('--clean');
  const doTrain = args.includes('--train');
  const trainOnly = args.includes('--train-only');
  const skipExisting = args.includes('--skip-existing');
  const modelId = args.find(a => a.startsWith('--model='))?.split('=')[1] || process.env.AZURE_DOCUMENT_AI_MODEL_ID || 'ihale-catering-v1';

  // --local <folder> parse
  const localIdx = args.indexOf('--local');
  const localFolder = localIdx >= 0 ? args[localIdx + 1] : null;

  if (trainOnly) {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  MODEL EGITIMI                                                      ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
    log(`Model: ${modelId}`, 'info');
    await trainModel(modelId);
    return;
  }

  if (localFolder) {
    await processLocalPdfs(localFolder, { dryRun, clean, doTrain, modelId, skipExisting });
  } else {
    await processUrlPdfs({ dryRun, clean, doTrain, modelId });
  }
}

main().catch(e => {
  console.error('\n❌ FATAL:', e.message);
  process.exit(1);
});
