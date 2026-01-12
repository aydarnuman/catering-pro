/**
 * Bordro Import Service - Proje Bazlı Akıllı Bordro İçe Aktarım
 * 
 * Özellikler:
 * - Template sistemi ile hızlı parse (AI'sız)
 * - Karmaşık Excel formatlarını AI ile analiz
 * - TC Kimlik ile personel eşleştirme
 * - Proje bazlı bordro kayıtları
 * - UPSERT: Aynı dönem varsa güncelle
 */

import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import {
  createFormatSignature,
  parseWithTemplate,
  findTemplateBySignature,
  saveTemplate,
  incrementTemplateUsage,
  createMappingFromAIResult,
  listTemplates
} from './bordro-template-service.js';

// Claude AI
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Proje personellerini getir
 */
export async function getProjePersonelleri(projeId) {
  const sql = `
    SELECT 
      p.id as personel_id,
      p.ad || ' ' || p.soyad as tam_ad,
      p.tc_kimlik,
      p.sgk_no,
      p.maas as brut_maas
    FROM proje_personelleri pp
    JOIN personeller p ON p.id = pp.personel_id
    WHERE pp.proje_id = $1 AND pp.aktif = TRUE
    ORDER BY p.ad, p.soyad
  `;
  
  const result = await query(sql, [projeId]);
  return result.rows;
}

/**
 * Tüm personelleri getir (proje dışı eşleştirme için)
 */
export async function getAllPersoneller() {
  const sql = `
    SELECT 
      id as personel_id,
      ad || ' ' || soyad as tam_ad,
      tc_kimlik,
      sgk_no,
      maas as brut_maas
    FROM personeller
    WHERE durum = 'aktif' OR durum IS NULL
    ORDER BY ad, soyad
  `;
  
  const result = await query(sql);
  return result.rows;
}

/**
 * Mevcut bordro kayıtlarını kontrol et
 */
export async function checkExistingBordro(projeId, yil, ay) {
  const sql = `
    SELECT 
      COUNT(*) as kayit_sayisi,
      SUM(net_maas) as toplam_net
    FROM bordro_kayitlari
    WHERE proje_id = $1 AND yil = $2 AND ay = $3
  `;
  
  const result = await query(sql, [projeId, yil, ay]);
  return result.rows[0];
}

/**
 * PDF dosyasını oku ve text çıkar
 */
async function extractPdfData(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  
  // PDF text'ini satırlara ayır
  const lines = pdfData.text.split('\n').filter(line => line.trim());
  
  return {
    textFormat: pdfData.text,
    lines,
    totalRows: lines.length,
    isPdf: true
  };
}

/**
 * Excel dosyasını oku ve ham veriyi çıkar
 * Birleşik hücreleri daha iyi handle et
 */
function extractExcelData(filePath) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Birleşik hücre bilgisi
  const merges = sheet['!merges'] || [];
  const hasMerges = merges.length > 50; // Çok fazla birleşik hücre varsa
  
  // Ham satır verisi (array of arrays)
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  // Header ve JSON formatı (kolon isimleriyle)
  const headers = rawData[0] || [];
  const json = xlsx.utils.sheet_to_json(sheet, { defval: null });
  
  // Text formatında da hazırla (AI için)
  // Birleşik hücreli dosyalarda daha detaylı format
  let textFormat;
  const maxRows = Math.min(rawData.length, 200);
  
  if (hasMerges) {
    // Birleşik hücreli dosya - her satırı daha detaylı göster
    textFormat = rawData.slice(0, maxRows).map((row, i) => {
      const values = row.map((cell, c) => {
        if (cell === null || cell === undefined || cell === '') return null;
        return `[${c}]${cell}`;
      }).filter(x => x !== null);
      return `Satır ${i}: ${values.join(' | ')}`;
    }).join('\n');
    
    // Merge bilgisini de ekle
    textFormat = `[BİRLEŞİK HÜCRELER: ${merges.length} adet]\n\n` + textFormat;
  } else {
    textFormat = rawData.slice(0, maxRows).map((row, i) => 
      `Satır ${i}: ${row.filter(c => c !== null && c !== undefined && c !== '').join(' | ')}`
    ).join('\n');
  }
  
  return {
    rawData,
    json,
    headers,
    textFormat,
    totalRows: rawData.length,
    hasMerges,
    mergeCount: merges.length,
    isPdf: false
  };
}

/**
 * Dosya tipine göre veri çıkar
 */
async function extractFileData(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.pdf') {
    console.log('📄 PDF dosyası algılandı');
    return await extractPdfData(filePath);
  } else {
    console.log('📊 Excel dosyası algılandı');
    return extractExcelData(filePath);
  }
}

/**
 * AI ile bordro verisini analiz et (Claude)
 * ÇİFT KATMANLI: Hem personel listesi hem de TAHAKKUK BİLGİLERİ özet tablosu
 */
async function analyzeBordroWithAI(fileData, yil, ay) {
  const isPdf = fileData.isPdf;
  const fileType = isPdf ? 'PDF' : 'Excel';
  
  const prompt = `Sen bir BORDRO ANALİZ UZMANISIN. Aşağıdaki ${fileType} verisinden:
1. HER PERSONELİN BORDRO KAYITLARINI çıkar
2. TAHAKKUK BİLGİLERİ (özet tablo) varsa onu da çıkar

HAM VERİ (Türk bordro formatı - ${fileType}):
${fileData.textFormat}

DÖNEM: ${yil} yılı ${ay}. ay

=== GÖREV 1: PERSONEL KAYITLARI ===
Her personel için şu bilgileri çıkar:
- personel_adi: Ad Soyad
- tc_kimlik: TC Kimlik No (11 haneli)
- sgk_no: SGK/Sigorta Sicil No
- ise_giris_tarihi: İşe Giriş Tarihi (YYYY-MM-DD)
- brut_maas: Aylık Ücret (ilk tutar kolonu)
- brut_toplam: Brüt Toplam
- sgk_isci: Sigorta Kesintisi (işçi payı)
- issizlik_isci: İşsizlik Sig. Kesintisi (işçi)
- gelir_vergisi: Gelir Vergisi
- damga_vergisi: Damga Vergisi
- agi_tutari: Vergi İndirimi / AGİ
- net_maas: Ödenecek Tutar / Net Ücret
- sgk_isveren: Sigorta Primi İşveren
- issizlik_isveren: İşsizlik Sigortası İşveren
- calisma_gunu: Prim Günü / Çalışılan Gün
- fazla_mesai: Fazla Mesai (varsa)
- sair_odeme: Sair Ödeme (varsa)
- sair_kesinti: Sair Kesinti (varsa)

=== GÖREV 2: TAHAKKUK BİLGİLERİ (ÖZET) ===
${isPdf ? 'PDF\'in alt kısmında "TAHAKKUK BİLGİLERİ" başlıklı özet tablo var.' : 'Dosyanın sonunda özet tablo olabilir.'}
Bu tablodan şu değerleri çıkar:
- aylik_ucret_toplami: Aylık Ücretler Toplamı
- fazla_mesai_toplami: Fazla Mesai Toplamı
- sair_odemeler_toplami: Sair Ödemeler Toplamı
- isveren_sgk_hissesi: İşveren SGK Hissesi
- isveren_issizlik: İşveren İşsizlik Sig. Kesintisi
- toplam_gider: Sol taraftaki TOPLAM
- odenecek_net_ucret: Ödenecek Net Ücretler
- odenecek_sgk_primi: Ödenecek SGK Primi
- odenecek_sgd_primi: Ödenecek SGD Primi / İşçi İşsizlik
- odenecek_gelir_vergisi: Ödenecek Gelir Vergisi
- odenecek_damga_vergisi: Ödenecek Damga Vergisi
- odenecek_issizlik: Ödenecek İşsizlik Sig. Kesintisi
- toplam_odeme: Sağ taraftaki TOPLAM
- toplam_sgk_primi: Toplam SGK Primi
- net_odenecek_sgk: Net Ödenecek SGK Primi

=== KURALLAR ===
1. Sayıları Türkçe formatından dönüştür: "26.005,50" → 26005.50
2. TC Kimlik 11 haneli olmalı
3. Tarihler YYYY-MM-DD formatında
4. TÜM personelleri çıkar ("TOPLAM", "EMEKLİ", "NORMAL" özet satırları hariç)
5. Tabloda bulamadığın alanları null bırak - TAHMİN ETME!
6. TAHAKKUK BİLGİLERİ tablosu yoksa tahakkuk alanını null bırak

SADECE JSON formatında yanıt ver:
{
  "records": [
    {
      "personel_adi": "ALİ KIRÇAYIR",
      "tc_kimlik": "10508424666",
      "sgk_no": "1234567890",
      "ise_giris_tarihi": "2024-05-15",
      "brut_maas": 26005.50,
      "brut_toplam": 26005.50,
      "sgk_isci": 3640.77,
      "issizlik_isci": 260.06,
      "gelir_vergisi": 1950.41,
      "damga_vergisi": 197.38,
      "agi_tutari": 0,
      "net_maas": 22104.67,
      "sgk_isveren": 4031.85,
      "issizlik_isveren": 520.11,
      "calisma_gunu": 30,
      "fazla_mesai": 0,
      "sair_odeme": 0,
      "sair_kesinti": 0
    }
  ],
  "tahakkuk": {
    "aylik_ucret_toplami": 903814.14,
    "fazla_mesai_toplami": 0,
    "sair_odemeler_toplami": 0,
    "isveren_sgk_hissesi": 192681.50,
    "isveren_issizlik": 15506.24,
    "toplam_gider": 1112001.88,
    "odenecek_net_ucret": 765575.57,
    "odenecek_sgk_primi": 269420.71,
    "odenecek_sgd_primi": 41442.09,
    "odenecek_gelir_vergisi": 11944.52,
    "odenecek_damga_vergisi": 359.51,
    "odenecek_issizlik": 23259.48,
    "toplam_odeme": 1112001.88,
    "toplam_sgk_primi": 334122.28,
    "net_odenecek_sgk": 334122.28
  },
  "warnings": [],
  "total": 37
}`;

  console.log('🤖 Claude ile bordro analizi yapılıyor...');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    const text = response.content[0].text;
    console.log('📝 Claude yanıtı alındı, parse ediliyor...');
    
    // JSON çıkar - code block içinde olabilir
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    // Temizle ve parse et
    jsonText = jsonText.trim();
    const result = JSON.parse(jsonText);
    
    console.log(`✅ ${result.records?.length || 0} kayıt parse edildi`);
    return result;
    
  } catch (error) {
    console.error('❌ Claude API hatası:', error.message);
    return { records: [], warnings: [`Claude API hatası: ${error.message}`], total: 0 };
  }
}

/**
 * Personel eşleştirme yap
 */
export function matchPersonnel(bordroRecords, personelList) {
  const results = {
    matched: [],
    unmatched: [],
    total: bordroRecords.length
  };
  
  for (const record of bordroRecords) {
    // TC Kimlik ile eşleştir
    let matched = personelList.find(p => 
      p.tc_kimlik && record.tc_kimlik && 
      p.tc_kimlik.toString().trim() === record.tc_kimlik.toString().trim()
    );
    
    // SGK No ile eşleştir
    if (!matched && record.sgk_no) {
      matched = personelList.find(p => 
        p.sgk_no && p.sgk_no.toString().trim() === record.sgk_no.toString().trim()
      );
    }
    
    // İsim benzerliği ile eşleştir (son çare)
    if (!matched && record.personel_adi) {
      const normalizedName = record.personel_adi.toUpperCase().trim();
      matched = personelList.find(p => {
        const pName = (p.tam_ad || '').toUpperCase().trim();
        return pName === normalizedName || 
               pName.includes(normalizedName) || 
               normalizedName.includes(pName);
      });
    }
    
    if (matched) {
      results.matched.push({
        ...record,
        personel_id: matched.personel_id,
        sistem_adi: matched.tam_ad,
        eslestirme_tipi: 'tc_kimlik'
      });
    } else {
      results.unmatched.push({
        ...record,
        eslestirme_tipi: 'bulunamadi'
      });
    }
  }
  
  return results;
}

/**
 * Ana bordro analiz fonksiyonu
 * Template varsa hızlı parse, yoksa AI ile analiz
 */
export async function analyzeBordroFile(filePath, projeId, yil, ay, options = {}) {
  const { forceAI = false, templateId = null } = options;
  
  console.log(`📥 Bordro analizi başlıyor: Proje ${projeId}, ${yil}/${ay}`);
  
  // 1. Dosyayı oku (Excel veya PDF)
  const fileData = await extractFileData(filePath);
  const fileType = fileData.isPdf ? 'PDF' : 'Excel';
  console.log(`✅ ${fileType} okundu: ${fileData.totalRows} satır${fileData.hasMerges ? ` (${fileData.mergeCount} birleşik hücre)` : ''}`);
  
  // 2. Format imzası oluştur (sadece Excel için)
  const formatSignature = fileData.isPdf ? null : createFormatSignature(fileData);
  if (formatSignature) {
    console.log(`🔑 Format imzası: ${formatSignature}`);
  }
  
  let parseResult = null;
  let usedTemplate = null;
  let aiUsed = false;
  
  // 3. Template kontrolü (forceAI değilse, sadece Excel için)
  if (!forceAI && !fileData.isPdf) {
    // Belirtilen template'i kullan
    if (templateId) {
      const templateResult = await query('SELECT * FROM bordro_templates WHERE id = $1', [templateId]);
      usedTemplate = templateResult.rows[0];
    }
    // veya imza ile otomatik bul
    else if (formatSignature) {
      usedTemplate = await findTemplateBySignature(formatSignature, projeId);
    }
    
    // Template bulunduysa kullan
    if (usedTemplate) {
      console.log(`📋 Template bulundu: "${usedTemplate.ad}" (${usedTemplate.kullanim_sayisi} kullanım)`);
      parseResult = parseWithTemplate(fileData, usedTemplate);
      
      if (parseResult.success && parseResult.records.length > 0) {
        console.log(`⚡ Template ile hızlı parse: ${parseResult.records.length} kayıt (AI kullanılmadı)`);
        await incrementTemplateUsage(usedTemplate.id);
      } else {
        console.log('⚠️ Template parse başarısız, AI\'a geçiliyor...');
        usedTemplate = null;
      }
    } else {
      console.log('📋 Eşleşen template bulunamadı');
    }
  }
  
  // 4. AI ile analiz (template yoksa veya başarısızsa)
  let tahakkuk = null;
  if (!parseResult || !parseResult.success || parseResult.records.length === 0) {
    console.log('🤖 AI ile analiz yapılıyor...');
    const aiResult = await analyzeBordroWithAI(fileData, yil, ay);
    aiUsed = true;
    
    parseResult = {
      success: true,
      records: aiResult.records || [],
      warnings: aiResult.warnings || [],
      total: aiResult.total || aiResult.records?.length || 0
    };
    
    // TAHAKKUK BİLGİLERİ'ni sakla
    if (aiResult.tahakkuk) {
      tahakkuk = aiResult.tahakkuk;
      console.log(`📊 TAHAKKUK BİLGİLERİ alındı: Brüt ${tahakkuk.aylik_ucret_toplami}, Net ${tahakkuk.odenecek_net_ucret}`);
    }
    
    console.log(`✅ AI analizi tamamlandı: ${parseResult.total} kayıt`);
    
    // AI sonucundan mapping oluştur (template kaydetmek için - sadece Excel)
    if (!fileData.isPdf) {
      const suggestedMapping = createMappingFromAIResult(aiResult, fileData);
      if (suggestedMapping) {
        parseResult.suggestedMapping = suggestedMapping;
        parseResult.formatSignature = formatSignature;
      }
    }
  }
  
  // 5. Proje personellerini getir
  let personelList;
  if (projeId) {
    personelList = await getProjePersonelleri(projeId);
    console.log(`✅ Proje personelleri: ${personelList.length} kişi`);
  } else {
    personelList = await getAllPersoneller();
    console.log(`✅ Tüm personeller: ${personelList.length} kişi`);
  }
  
  // 6. Eşleştirme yap
  const matchResult = matchPersonnel(parseResult.records || [], personelList);
  console.log(`✅ Eşleştirme: ${matchResult.matched.length} eşleşti, ${matchResult.unmatched.length} bulunamadı`);
  
  // 7. Mevcut bordro kontrolü
  const existing = await checkExistingBordro(projeId, yil, ay);
  
  // 8. ÇİFT KATMANLI DOĞRULAMA - Personel toplamları vs Tahakkuk
  let verification = null;
  if (tahakkuk) {
    // Personel kayıtlarından toplamları hesapla
    const records = [...matchResult.matched, ...matchResult.unmatched];
    const personelTotals = {
      brut_toplam: records.reduce((sum, r) => sum + (parseFloat(r.brut_toplam) || parseFloat(r.brut_maas) || 0), 0),
      net_toplam: records.reduce((sum, r) => sum + (parseFloat(r.net_maas) || 0), 0),
      sgk_isci: records.reduce((sum, r) => sum + (parseFloat(r.sgk_isci) || 0), 0),
      sgk_isveren: records.reduce((sum, r) => sum + (parseFloat(r.sgk_isveren) || 0), 0),
      gelir_vergisi: records.reduce((sum, r) => sum + (parseFloat(r.gelir_vergisi) || 0), 0),
      damga_vergisi: records.reduce((sum, r) => sum + (parseFloat(r.damga_vergisi) || 0), 0)
    };
    
    // Karşılaştırma
    const tolerance = 1; // 1 TL tolerans
    verification = {
      personelTotals,
      tahakkuk,
      comparison: {
        brut: {
          personel: personelTotals.brut_toplam,
          tahakkuk: tahakkuk.aylik_ucret_toplami || 0,
          match: Math.abs(personelTotals.brut_toplam - (tahakkuk.aylik_ucret_toplami || 0)) < tolerance
        },
        net: {
          personel: personelTotals.net_toplam,
          tahakkuk: tahakkuk.odenecek_net_ucret || 0,
          match: Math.abs(personelTotals.net_toplam - (tahakkuk.odenecek_net_ucret || 0)) < tolerance
        },
        sgk_isveren: {
          personel: personelTotals.sgk_isveren,
          tahakkuk: tahakkuk.isveren_sgk_hissesi || 0,
          match: Math.abs(personelTotals.sgk_isveren - (tahakkuk.isveren_sgk_hissesi || 0)) < tolerance
        },
        gelir_vergisi: {
          personel: personelTotals.gelir_vergisi,
          tahakkuk: tahakkuk.odenecek_gelir_vergisi || 0,
          match: Math.abs(personelTotals.gelir_vergisi - (tahakkuk.odenecek_gelir_vergisi || 0)) < tolerance
        }
      },
      allMatch: false
    };
    
    verification.allMatch = verification.comparison.brut.match && 
                            verification.comparison.net.match;
    
    if (!verification.allMatch) {
      console.log('⚠️ UYARI: Personel toplamları ile TAHAKKUK uyuşmuyor!');
      console.log(`   Brüt: Personel ${personelTotals.brut_toplam.toFixed(2)} vs Tahakkuk ${tahakkuk.aylik_ucret_toplami}`);
      console.log(`   Net: Personel ${personelTotals.net_toplam.toFixed(2)} vs Tahakkuk ${tahakkuk.odenecek_net_ucret}`);
    } else {
      console.log('✅ Doğrulama başarılı: Toplamlar uyuşuyor');
    }
  }
  
  return {
    success: true,
    yil,
    ay,
    proje_id: projeId,
    matched: matchResult.matched,
    unmatched: matchResult.unmatched,
    stats: {
      total: matchResult.total,
      matched: matchResult.matched.length,
      unmatched: matchResult.unmatched.length
    },
    existing: {
      kayit_sayisi: parseInt(existing.kayit_sayisi) || 0,
      toplam_net: parseFloat(existing.toplam_net) || 0
    },
    warnings: parseResult.warnings || [],
    // Template bilgisi
    templateInfo: {
      aiUsed,
      usedTemplate: usedTemplate ? { id: usedTemplate.id, ad: usedTemplate.ad } : null,
      suggestedMapping: parseResult.suggestedMapping || null,
      formatSignature: formatSignature,
      canSaveTemplate: aiUsed && parseResult.suggestedMapping !== null
    },
    // ÇİFT KATMANLI DOĞRULAMA
    tahakkuk,
    verification
  };
}

/**
 * Bordro kayıtlarını veritabanına kaydet
 */
export async function saveBordroRecords(records, projeId, yil, ay, kaynakDosya) {
  const results = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: []
  };
  
  for (const record of records) {
    try {
      // UPSERT: Varsa güncelle, yoksa ekle
      const sql = `
        INSERT INTO bordro_kayitlari (
          personel_id, proje_id, yil, ay,
          calisma_gunu, brut_maas, brut_toplam,
          sgk_matrahi, sgk_isci, issizlik_isci, toplam_isci_sgk,
          vergi_matrahi, kumulatif_matrah,
          gelir_vergisi, damga_vergisi, agi_tutari,
          net_maas,
          sgk_isveren, issizlik_isveren, toplam_isveren_sgk,
          toplam_maliyet,
          kaynak, kaynak_dosya
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13,
          $14, $15, $16,
          $17,
          $18, $19, $20,
          $21,
          'excel_import', $22
        )
        ON CONFLICT (personel_id, proje_id, yil, ay)
        DO UPDATE SET
          calisma_gunu = EXCLUDED.calisma_gunu,
          brut_maas = EXCLUDED.brut_maas,
          brut_toplam = EXCLUDED.brut_toplam,
          sgk_matrahi = EXCLUDED.sgk_matrahi,
          sgk_isci = EXCLUDED.sgk_isci,
          issizlik_isci = EXCLUDED.issizlik_isci,
          toplam_isci_sgk = EXCLUDED.toplam_isci_sgk,
          vergi_matrahi = EXCLUDED.vergi_matrahi,
          gelir_vergisi = EXCLUDED.gelir_vergisi,
          damga_vergisi = EXCLUDED.damga_vergisi,
          agi_tutari = EXCLUDED.agi_tutari,
          net_maas = EXCLUDED.net_maas,
          sgk_isveren = EXCLUDED.sgk_isveren,
          issizlik_isveren = EXCLUDED.issizlik_isveren,
          toplam_isveren_sgk = EXCLUDED.toplam_isveren_sgk,
          toplam_maliyet = EXCLUDED.toplam_maliyet,
          kaynak = 'excel_import',
          kaynak_dosya = EXCLUDED.kaynak_dosya,
          updated_at = NOW()
        RETURNING id, (xmax = 0) as inserted
      `;
      
      // PDF'DEN GELEN DEĞERLERİ KULLAN - HESAPLAMA YAPMA!
      // Eksik değerler null kalacak, sonradan doğrulama yapılacak
      const brutMaas = parseFloat(record.brut_maas) || 0;
      const brutToplam = parseFloat(record.brut_toplam) || brutMaas;
      
      // SGK İşçi - PDF'den gelen değer, yoksa null DEĞİL sıfır
      const sgkIsci = record.sgk_isci !== null && record.sgk_isci !== undefined 
        ? parseFloat(record.sgk_isci) : 0;
      const issizlikIsci = record.issizlik_isci !== null && record.issizlik_isci !== undefined 
        ? parseFloat(record.issizlik_isci) : 0;
      const toplamIsciSgk = sgkIsci + issizlikIsci;
      
      const sgkMatrahi = brutToplam;
      const vergiMatrahi = brutToplam - toplamIsciSgk;
      
      // Vergiler - PDF'den gelen değer, yoksa 0 (hesaplama YOK)
      const gelirVergisi = record.gelir_vergisi !== null && record.gelir_vergisi !== undefined 
        ? parseFloat(record.gelir_vergisi) : 0;
      const damgaVergisi = record.damga_vergisi !== null && record.damga_vergisi !== undefined 
        ? parseFloat(record.damga_vergisi) : 0;
      const agiTutari = record.agi_tutari !== null && record.agi_tutari !== undefined 
        ? parseFloat(record.agi_tutari) : 0;
      
      const netMaas = parseFloat(record.net_maas) || 0;
      
      // SGK İşveren - PDF'den gelen değer, yoksa 0 (hesaplama YOK)
      const sgkIsveren = record.sgk_isveren !== null && record.sgk_isveren !== undefined 
        ? parseFloat(record.sgk_isveren) : 0;
      const issizlikIsveren = record.issizlik_isveren !== null && record.issizlik_isveren !== undefined 
        ? parseFloat(record.issizlik_isveren) : 0;
      const toplamIsverenSgk = sgkIsveren + issizlikIsveren;
      const toplamMaliyet = brutToplam + toplamIsverenSgk;
      
      const calismaGunu = parseInt(record.calisma_gunu) || 30;
      
      const values = [
        record.personel_id,
        projeId,
        yil,
        ay,
        calismaGunu,
        brutMaas,
        brutToplam,
        sgkMatrahi,
        sgkIsci,
        issizlikIsci,
        toplamIsciSgk,
        vergiMatrahi,
        vergiMatrahi, // kümülatif matrah (basitleştirilmiş)
        gelirVergisi,
        damgaVergisi,
        agiTutari,
        netMaas,
        sgkIsveren,
        issizlikIsveren,
        toplamIsverenSgk,
        toplamMaliyet,
        kaynakDosya
      ];
      
      const result = await query(sql, values);
      
      if (result.rows[0]?.inserted) {
        results.inserted++;
      } else {
        results.updated++;
      }
      
    } catch (error) {
      results.failed++;
      results.errors.push({
        personel: record.personel_adi || record.personel_id,
        error: error.message
      });
      console.error(`❌ Kayıt hatası: ${record.personel_adi}`, error.message);
    }
  }
  
  console.log(`📥 Bordro kayıt tamamlandı: ${results.inserted} eklendi, ${results.updated} güncellendi, ${results.failed} hatalı`);
  
  return results;
}

/**
 * Yeni personel oluştur ve projeye ekle
 */
export async function createPersonelFromBordro(record, projeId) {
  try {
    // 1. Ad Soyad ayır
    const nameParts = (record.personel_adi || 'Bilinmeyen Kişi').split(' ');
    const ad = nameParts.slice(0, -1).join(' ') || nameParts[0];
    const soyad = nameParts.slice(-1)[0] || '';
    
    // 2. İşe giriş tarihi - bordrodan gelen veya bugün
    let iseGirisTarihi = null;
    if (record.ise_giris_tarihi) {
      // Farklı tarih formatlarını dene
      const dateStr = record.ise_giris_tarihi.toString();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        iseGirisTarihi = dateStr;
      } else if (dateStr.match(/^\d{2}[./-]\d{2}[./-]\d{4}$/)) {
        // DD/MM/YYYY veya DD.MM.YYYY formatı
        const parts = dateStr.split(/[./-]/);
        iseGirisTarihi = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    const insertSql = `
      INSERT INTO personeller (
        ad, soyad, tc_kimlik, sgk_no, maas, durum, 
        ise_giris_tarihi, departman, pozisyon
      )
      VALUES ($1, $2, $3, $4, $5, 'aktif', $6, $7, $8)
      RETURNING id
    `;
    
    const result = await query(insertSql, [
      ad,
      soyad,
      record.tc_kimlik || null,
      record.sgk_no || null,
      record.brut_maas || 0,
      iseGirisTarihi || new Date().toISOString().split('T')[0],
      record.departman || null,
      record.pozisyon || null
    ]);
    
    const personelId = result.rows[0].id;
    
    // 2. Projeye ekle
    if (projeId) {
      await query(`
        INSERT INTO proje_personelleri (proje_id, personel_id, baslangic_tarihi, aktif)
        VALUES ($1, $2, CURRENT_DATE, TRUE)
        ON CONFLICT DO NOTHING
      `, [projeId, personelId]);
    }
    
    return { success: true, personel_id: personelId };
    
  } catch (error) {
    console.error('Personel oluşturma hatası:', error);
    return { success: false, error: error.message };
  }
}

/**
 * TAHAKKUK BİLGİLERİNİ veritabanına kaydet
 */
export async function saveTahakkuk(tahakkuk, projeId, yil, ay, kaynakDosya) {
  if (!tahakkuk) return null;
  
  const sql = `
    INSERT INTO bordro_tahakkuk (
      proje_id, yil, ay,
      aylik_ucret_toplami, fazla_mesai_toplami, sair_odemeler_toplami,
      isveren_sgk_hissesi, isveren_issizlik, toplam_gider,
      odenecek_net_ucret, odenecek_sgk_primi, odenecek_sgd_primi,
      odenecek_gelir_vergisi, odenecek_damga_vergisi, odenecek_issizlik,
      toplam_odeme, toplam_sgk_primi, net_odenecek_sgk,
      personel_sayisi, kaynak_dosya
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16, $17, $18,
      $19, $20
    )
    ON CONFLICT (proje_id, yil, ay) DO UPDATE SET
      aylik_ucret_toplami = EXCLUDED.aylik_ucret_toplami,
      fazla_mesai_toplami = EXCLUDED.fazla_mesai_toplami,
      sair_odemeler_toplami = EXCLUDED.sair_odemeler_toplami,
      isveren_sgk_hissesi = EXCLUDED.isveren_sgk_hissesi,
      isveren_issizlik = EXCLUDED.isveren_issizlik,
      toplam_gider = EXCLUDED.toplam_gider,
      odenecek_net_ucret = EXCLUDED.odenecek_net_ucret,
      odenecek_sgk_primi = EXCLUDED.odenecek_sgk_primi,
      odenecek_sgd_primi = EXCLUDED.odenecek_sgd_primi,
      odenecek_gelir_vergisi = EXCLUDED.odenecek_gelir_vergisi,
      odenecek_damga_vergisi = EXCLUDED.odenecek_damga_vergisi,
      odenecek_issizlik = EXCLUDED.odenecek_issizlik,
      toplam_odeme = EXCLUDED.toplam_odeme,
      toplam_sgk_primi = EXCLUDED.toplam_sgk_primi,
      net_odenecek_sgk = EXCLUDED.net_odenecek_sgk,
      personel_sayisi = EXCLUDED.personel_sayisi,
      kaynak_dosya = EXCLUDED.kaynak_dosya,
      updated_at = NOW()
    RETURNING id
  `;
  
  try {
    const result = await query(sql, [
      projeId,
      yil,
      ay,
      tahakkuk.aylik_ucret_toplami || null,
      tahakkuk.fazla_mesai_toplami || 0,
      tahakkuk.sair_odemeler_toplami || 0,
      tahakkuk.isveren_sgk_hissesi || null,
      tahakkuk.isveren_issizlik || null,
      tahakkuk.toplam_gider || null,
      tahakkuk.odenecek_net_ucret || null,
      tahakkuk.odenecek_sgk_primi || null,
      tahakkuk.odenecek_sgd_primi || null,
      tahakkuk.odenecek_gelir_vergisi || null,
      tahakkuk.odenecek_damga_vergisi || null,
      tahakkuk.odenecek_issizlik || null,
      tahakkuk.toplam_odeme || null,
      tahakkuk.toplam_sgk_primi || null,
      tahakkuk.net_odenecek_sgk || null,
      tahakkuk.personel_sayisi || null,
      kaynakDosya
    ]);
    
    console.log('✅ TAHAKKUK BİLGİLERİ kaydedildi:', result.rows[0]?.id);
    return result.rows[0];
  } catch (error) {
    console.error('❌ TAHAKKUK kayıt hatası:', error.message);
    return null;
  }
}

/**
 * Dönem için TAHAKKUK BİLGİLERİNİ getir
 */
export async function getTahakkuk(projeId, yil, ay) {
  const sql = `
    SELECT * FROM bordro_tahakkuk
    WHERE (proje_id = $1 OR ($1 IS NULL AND proje_id IS NULL))
      AND yil = $2 AND ay = $3
  `;
  
  const result = await query(sql, [projeId, yil, ay]);
  return result.rows[0] || null;
}

// Re-export template fonksiyonları
export { 
  listTemplates, 
  saveTemplate, 
  findTemplateBySignature,
  parseWithTemplate
};

export default {
  analyzeBordroFile,
  saveBordroRecords,
  getProjePersonelleri,
  getAllPersoneller,
  checkExistingBordro,
  matchPersonnel,
  createPersonelFromBordro,
  // Template fonksiyonları
  listTemplates,
  saveTemplate,
  findTemplateBySignature,
  parseWithTemplate
};

