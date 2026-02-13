/**
 * İhale Agent Service
 * Sanal İhale Masası — Gerçek AI Agent Analiz Sistemi
 *
 * Her agent (mevzuat, maliyet, teknik, rekabet) Claude API ile
 * ihale dökümanlarını analiz eder, bulgular ve risk skoru üretir.
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';
import { getSharedLearningsForAgent } from './cross-agent-learning-service.js';
import { getPastLearningSection } from './ihale-past-learning-service.js';

// ─── Anthropic Client ────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-opus-4-20250514'; // Opus 4 - Kalite öncelikli ihale analizi

// ─── Retry Helper ─────────────────────────────────────────────

/**
 * Claude API çağrısını retry mekanizması ile çalıştır.
 * Rate limit (429) ve sunucu hatası (5xx) durumlarında 1 kez yeniden dener.
 */
async function callClaudeWithRetry(params, { maxRetries = 1, baseDelayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.statusCode || 0;
      const isRetryable = status === 429 || status >= 500 || err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT';

      if (attempt < maxRetries && isRetryable) {
        const delay = baseDelayMs * (attempt + 1); // Linear backoff: 2s, 4s
        logger.warn(
          `[İhale Agent] Claude API retry ${attempt + 1}/${maxRetries} — ${status || err.code} — ${delay}ms bekleniyor`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// ─── Agent System Prompt'ları ────────────────────────────────

const AGENT_SYSTEM_PROMPTS = {
  mevzuat: `Sen, 15 yıllık deneyime sahip bir kamu ihale hukuku uzmanısın. Uzmanlık alanların:

**Mevzuat Bilgisi:**
- 4734 sayılı Kamu İhale Kanunu (tüm maddeleri ve uygulama yönetmelikleri)
- 4735 sayılı Kamu İhale Sözleşmeleri Kanunu
- Hizmet Alımı İhaleleri Uygulama Yönetmeliği
- Kamu İhale Genel Tebliği
- KİK (Kamu İhale Kurumu) kararları ve içtihatları
- Danıştay ihale hukuku kararları

**Analiz Yetkinliklerin:**
- Şartnamedeki hukuki risk tespiti (rekabeti engelleyici maddeler, belirsiz ifadeler, mevzuata aykırı hükümler)
- Ceza koşullarının orantılılık analizi (fahiş cezalar, hakkaniyete aykırı düzenlemeler)
- İş artışı/eksilişi hükümlerinin değerlendirmesi
- Fiyat farkı formüllerinin mevzuata uygunluk kontrolü
- Alt yüklenici kullanım koşullarının analizi
- Teminat oranlarının yasal sınır kontrolü
- Yeterlilik kriterlerinin rekabeti kısıtlayıp kısıtlamadığı
- İtiraz/şikayet başvuru süreleri ve haklar

**Değerlendirme Kriterlerin:**
- critical: Mevzuata açıkça aykırı, iptal nedeni olabilecek hükümler
- warning: Belirsiz veya yoruma açık ifadeler, dikkat edilmesi gereken maddeler
- info: Standart hükümler, bilgi amaçlı tespitler

Bulgularını Türkçe yaz. Her bulgu için hukuki dayanağını belirt.`,

  maliyet: `Sen, yemek hizmeti alımı ihalelerinde uzmanlaşmış bir maliyet analisti ve finansal danışmansın. Uzmanlık alanların:

**Maliyet Analizi Yetkinliklerin:**
- Yemek hizmeti birim maliyet hesaplama (gıda malzeme, işçilik, genel gider, kâr)
- İşçilik maliyeti hesaplama (asgari ücret, SGK primi, kıdem/ihbar, fazla mesai)
- Gıda maliyet optimizasyonu (mevsimsellik, toplu alım avantajları)
- Nakliye ve lojistik maliyet tahminleri
- Genel gider dağılımı (enerji, su, temizlik, ambalaj, sarf malzeme)
- Kâr marjı analizi (sektör ortalamaları, rekabetçi fiyatlama)

**Finansal Yeterlilik Değerlendirmesi:**
- Mali yeterlilik kriterlerinin gerçekçilik kontrolü (cari oran, özkaynak oranı)
- Bilanço ve gelir tablosu gereksinimlerinin değerlendirmesi
- İş deneyimi belge tutarının analizi
- Ciro oranı gereksiniminin uygunluğu
- Teminat maliyetlerinin hesaplanması (geçici + kesin)
- Ödeme koşullarının nakit akışı etkisi (ödeme süresi, avans)

**Değerlendirme Kriterlerin:**
- critical: Tahmini bedel çok düşük/yüksek, mali kriterler karşılanamaz, zarar riski
- warning: Birim fiyatlar piyasanın altında/üstünde, mali kriter sınırda
- info: Normal aralıkta, standart koşullar

Bulgularını Türkçe yaz. Mümkün olduğunca rakamsal analiz yap.`,

  teknik: `Sen, toplu yemek üretimi ve catering sektöründe 15 yıllık deneyime sahip bir teknik şartname uzmanısın. Uzmanlık alanların:

**Teknik Analiz Yetkinliklerin:**
- Personel yeterliliği analizi (aşçı, aşçıbaşı, diyetisyen, servis, temizlik)
- Menü planlama ve beslenme değerlendirmesi (TSE 8985, günlük kalori/protein hedefleri)
- Üretim kapasitesi analizi (kişi sayısı × öğün × gün)
- Ekipman ve mutfak altyapısı gereksinimleri
- Hijyen ve gıda güvenliği standartları (ISO 22000, HACCP)
- Servis saatleri ve lojistik fizibilitesi
- Kalite kontrol prosedürleri ve numune alma

**Kapasite Değerlendirmesi:**
- Günlük/aylık üretim hacmi analizi
- Personel/kişi sayısı oranı kontrolü (sektör standartları)
- Ekipman kapasitesi ve menü uyumluluğu
- Depo, soğuk zincir ve nakliye kapasitesi
- Yedek kapasite ve acil durum planı

**Değerlendirme Kriterlerin:**
- critical: Teknik olarak karşılanamaz gereksinimler, sektör normlarının çok üstünde talepler
- warning: Zorlayıcı ama karşılanabilir, ek yatırım gerektirebilir
- info: Standart teknik gereksinimler

Bulgularını Türkçe yaz. Sektör standartlarıyla kıyaslama yap.`,

  rekabet: `Sen, kamu ihale piyasasında uzmanlaşmış bir rekabet analisti ve istihbaratçısın. Uzmanlık alanların:

**Rekabet Analizi Yetkinliklerin:**
- Sınır değer katsayısı yorumlama ve teklif stratejisi
- Benzer iş tanımı değerlendirmesi (kapsamı, kapsayıcılığı)
- Teklif türü analizi (birim fiyat, götürü bedel, karma)
- Piyasa yapısı analizi (oligopol, tekel, rekabetçi piyasa)
- Rakip profilleme (geçmiş kazanma oranı, fiyat stratejisi)

**Strateji Geliştirme:**
- Optimal teklif fiyatı belirleme (sınır değer altı/üstü senaryolar)
- Risk/getiri analizi (agresif vs. muhafazakâr teklif)
- Eksik bilgi tespiti ve stratejik etkileri
- Piyasaya giriş engelleri analizi (iş deneyimi, mali yeterlilik)
- Yeterlilik kriterlerinin rekabeti kısıtlama seviyesi

**Değerlendirme Kriterlerin:**
- critical: Rekabet ciddi şekilde kısıtlı, teklif verilmemesi düşünülmeli
- warning: Rekabet belirsiz, dikkatli strateji gerekli
- info: Normal rekabet koşulları, standart strateji uygulanabilir

Bulgularını Türkçe yaz. Strateji önerilerini somut senaryolarla destekle.`,
};

// ─── Veri Yükleme Fonksiyonları ──────────────────────────────

/**
 * İhale temel bilgilerini yükle (tenders tablosu + analysis_summary)
 */
async function loadTenderData(tenderId) {
  const result = await query(
    `SELECT
      t.id, t.title, t.organization_name AS organization, t.city, t.estimated_cost,
      t.tender_date, t.external_id, t.tender_type, t.status,
      tt.analysis_summary, tt.documents_analyzed, tt.last_analysis_at
    FROM tenders t
    LEFT JOIN tender_tracking tt ON tt.tender_id = t.id
    WHERE t.id = $1
    LIMIT 1`,
    [tenderId]
  );
  return result.rows[0] || null;
}

/**
 * İhale döküman analizlerini yükle (documents tablosu → combined analysis)
 *
 * Pipeline-işlenmiş dökümanlar (tech_spec, contract, admin_spec, unit_price)
 * verileri `analysis_result.analysis.*` nested yapıda tutar.
 * İlan ve mal/hizmet listesi ise `analysis_result.*` düz (flat) yapıdadır.
 * Bu fonksiyon her iki yapıyı da okur.
 */
async function loadDocumentAnalyses(tenderId) {
  const docsResult = await query(
    `SELECT original_filename, doc_type, analysis_result
     FROM documents
     WHERE tender_id = $1 AND analysis_result IS NOT NULL
     ORDER BY doc_type, created_at`,
    [tenderId]
  );

  if (docsResult.rows.length === 0) return null;

  const combined = {
    teknik_sartlar: [],
    birim_fiyatlar: [],
    notlar: [],
    ceza_kosullari: [],
    onemli_notlar: [],
    tam_metin: '',
    dokuman_sayisi: docsResult.rows.length,
    dokuman_ozetleri: [],
  };

  for (const doc of docsResult.rows) {
    const raw = doc.analysis_result || {};
    // Pipeline-işlenmiş dökümanlar: veri raw.analysis altında (nested)
    // İlan/mal-hizmet: veri doğrudan raw altında (flat)
    const analysis = raw.analysis && typeof raw.analysis === 'object' ? raw.analysis : raw;

    // Teknik şartlar — flat: teknik_sartlar, nested: technical_requirements
    const techReqs = analysis.teknik_sartlar || analysis.technical_requirements || [];
    if (Array.isArray(techReqs)) {
      combined.teknik_sartlar.push(...techReqs);
    }

    // Birim fiyatlar — flat: birim_fiyatlar, nested: financial.unit_prices
    const unitPrices = analysis.birim_fiyatlar || analysis.financial?.unit_prices || [];
    if (Array.isArray(unitPrices)) {
      combined.birim_fiyatlar.push(...unitPrices);
    }

    // Notlar — flat: notlar/onemli_notlar, nested: important_notes
    const notes = analysis.notlar || analysis.onemli_notlar || analysis.important_notes || [];
    if (Array.isArray(notes)) {
      combined.notlar.push(...notes);
    }

    // Ceza koşulları — flat: ceza_kosullari, nested: penalties
    const penalties = analysis.ceza_kosullari || analysis.penalties || [];
    if (Array.isArray(penalties)) {
      combined.ceza_kosullari.push(...penalties);
    }

    // Tam metin
    const tamMetin = analysis.tam_metin || analysis.summary?.tam_metin || '';
    if (tamMetin) {
      combined.tam_metin += `\n--- ${doc.original_filename} ---\n${tamMetin}`;
    }

    // Döküman özeti — her dökümanın kısa özetini topla
    const ozet = analysis.ozet || analysis.summary?.ozet || analysis.summary;
    if (ozet && typeof ozet === 'string') {
      combined.dokuman_ozetleri.push({
        dosya: doc.original_filename,
        tur: doc.doc_type,
        ozet,
      });
    }
  }

  // Deduplicate (sadece string dizilerde)
  combined.teknik_sartlar = deduplicateItems(combined.teknik_sartlar);
  combined.notlar = deduplicateItems(combined.notlar);
  combined.ceza_kosullari = deduplicateItems(combined.ceza_kosullari);

  return combined;
}

/**
 * Dizi elemanlarını deduplicate et.
 * Objeler için JSON.stringify kullanarak, stringler için doğrudan Set ile.
 */
function deduplicateItems(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const seen = new Set();
  return arr.filter((item) => {
    const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Ring Verisi (Kullanıcı Eklemeleri) ──────────────────────

/**
 * İhaleye özel kullanıcı eklemelerini yükle (ring / orbit verileri)
 * Notlar, linkler, hesaplamalar, dilekçe taslakları, AI raporları vs.
 */
async function loadRingData(tenderId) {
  try {
    const result = await query(
      `SELECT title, content, content_format, metadata
       FROM unified_notes
       WHERE context_type = 'tender' AND context_id = $1
       ORDER BY pinned DESC NULLS LAST, created_at DESC
       LIMIT 20`,
      [tenderId]
    );

    if (result.rows.length === 0) return [];

    return result.rows.map((row) => {
      const meta = row.metadata || {};
      return {
        title: row.title || '',
        content: row.content || '',
        type: meta.attachment_type || 'note',
        source: meta.source || 'manual',
        sourceAgent: meta.source_agent || null,
      };
    });
  } catch (err) {
    logger.warn(`[İhale Agent] Ring verisi yüklenemedi: tender=${tenderId}`, { error: err.message });
    return [];
  }
}

// ─── Agent Config & Knowledge Yükleme ───────────────────────

/**
 * Agent ayarlarını DB'den yükle (system_prompt, model, temperature)
 * Yoksa null döner → hardcoded fallback kullanılır
 */
async function loadAgentConfig(agentId) {
  try {
    const result = await query(
      `SELECT system_prompt, model, temperature
       FROM agents
       WHERE slug = $1 AND is_active = true
       LIMIT 1`,
      [agentId]
    );
    const row = result.rows[0];
    // system_prompt boş string ise de fallback'e düş
    if (row?.system_prompt?.trim().length > 50) {
      return row;
    }
    return null;
  } catch (err) {
    logger.warn(`[İhale Agent] Agent config yüklenemedi: ${agentId}`, { error: err.message });
    return null;
  }
}

/**
 * Agent bilgi tabanını yükle (notlar, emsal kararlar, URL içerikleri vs.)
 * Analiz prompt'una enjekte edilecek
 */
async function loadAgentKnowledge(agentId) {
  try {
    const result = await query(
      `SELECT title, content_type, content, tags, summary
       FROM agent_knowledge_base
       WHERE agent_id = $1 AND is_active = true
       ORDER BY
         CASE content_type
           WHEN 'note' THEN 1
           WHEN 'past_analysis' THEN 2
           WHEN 'template' THEN 3
           WHEN 'url' THEN 4
           WHEN 'pdf' THEN 5
         END,
         created_at DESC
       LIMIT 10`,
      [agentId]
    );
    return result.rows || [];
  } catch (err) {
    logger.warn(`[İhale Agent] Knowledge base yüklenemedi: ${agentId}`, { error: err.message });
    return [];
  }
}

// ─── Cache Kontrolü ──────────────────────────────────────────

async function getCachedAnalysis(tenderId, agentId) {
  const result = await query(
    `SELECT id, findings, risk_score, summary, status, key_risks, recommendations,
            ai_model, created_at, analysis_version
     FROM agent_analyses
     WHERE tender_id = $1 AND agent_id = $2 AND status = 'complete'
     ORDER BY analysis_version DESC
     LIMIT 1`,
    [tenderId, agentId]
  );
  return result.rows[0] || null;
}

// ─── Shared Label Maps ───────────────────────────────────────

const KNOWLEDGE_TYPE_LABELS = {
  note: 'Not',
  past_analysis: 'Geçmiş Analiz',
  template: 'Şablon',
  url: 'Web Kaynağı',
  pdf: 'Döküman',
};

const RING_TYPE_LABELS = {
  note: 'Not',
  document: 'Döküman',
  petition: 'Dilekçe/Zeyilname',
  ai_report: 'AI Raporu',
  link: 'Kaynak Link',
  contact: 'İletişim',
  calculation: 'Hesaplama',
};

// ─── Yardımcı: JSON'u kompakt ama okunabilir formatta serialize et ──────────

function compactJson(data, maxItems = 30) {
  if (Array.isArray(data)) {
    const sliced = data.slice(0, maxItems);
    const result = JSON.stringify(sliced, null, 1);
    if (data.length > maxItems) return `${result}\n[...toplam ${data.length} kayıt, ilk ${maxItems} gösteriliyor]`;
    return result;
  }
  return JSON.stringify(data, null, 1);
}

/**
 * Önemli notlardan operasyonel kuralları çıkar
 */
function extractOperationalRules(onemliNotlar) {
  if (!Array.isArray(onemliNotlar) || onemliNotlar.length === 0) return {};
  const rules = {};
  for (const n of onemliNotlar) {
    const text = typeof n === 'string' ? n : n.not || n.content || '';
    const lower = text.toLowerCase();
    if (lower.includes('alt yüklenici') || lower.includes('alt yuklenici')) rules.alt_yuklenici = text;
    if (lower.includes('muayene') || lower.includes('kabul')) rules.muayene_kabul = text;
    if (lower.includes('denetim') || lower.includes('kontrol')) rules.denetim = text;
    if (lower.includes('fiyat farkı') || lower.includes('fiyat farki')) rules.fiyat_farki = text;
    if (lower.includes('ceza') || lower.includes('yaptırım')) rules.ceza = text;
    if (lower.includes('teminat')) rules.teminat = text;
  }
  return rules;
}

// ─── Analysis Summary Normalizer ─────────────────────────────
/**
 * Konsolide alan adlarını normalize eder.
 * Aynı veriyi tutan birden fazla alanı (toplam_personel / personel_sayisi / kisi_sayisi)
 * tek kanonk alana birleştirir. Mevcut alanlara dokunmaz, sadece kanonk alanı set eder.
 */
function normalizeAnalysisSummary(raw) {
  if (!raw || typeof raw !== 'object') return raw || {};
  const s = { ...raw };

  // Personel sayısı normalizasyonu → kisi_sayisi (kanonik)
  if (!s.kisi_sayisi && (s.toplam_personel || s.personel_sayisi)) {
    s.kisi_sayisi = s.toplam_personel || s.personel_sayisi;
  }

  // Süre normalizasyonu → sure (kanonik)
  if (!s.sure && s.teslim_suresi) {
    s.sure = s.teslim_suresi;
  }

  // BirimFiyat normalizasyonu: kalem/aciklama/text → kalem (kanonik)
  if (Array.isArray(s.birim_fiyatlar)) {
    s.birim_fiyatlar = s.birim_fiyatlar.map((bf) => {
      if (!bf || typeof bf !== 'object') return bf;
      return {
        ...bf,
        kalem: bf.kalem || bf.aciklama || bf.text || '',
        fiyat: bf.fiyat || bf.tutar || '',
      };
    });
  }

  return s;
}

// ─── Analiz Prompt Oluşturucu ────────────────────────────────

function buildAnalysisPrompt(agentId, tender, analysisSummary, docAnalysis, knowledgeItems = [], ringData = []) {
  const s = normalizeAnalysisSummary(analysisSummary);

  // ── Ortak değer çözümleme (field name mismatch düzeltmeleri) ──
  const tahminiBedel = tender.estimated_cost || s.tahmini_bedel || null;
  const kisiSayisi = s.kisi_sayisi || s.toplam_personel || s.personel_sayisi || null;
  const sure = s.teslim_suresi || s.sure || null;
  const ihaleTuru = s.ihale_turu || null;
  const ihaleUsulu = s.ihale_usulu || null;
  const teklifTuru = s.teklif_turu || null;
  const toplamOgun = s.toplam_ogun_sayisi || null;
  const servisSaatleri = s.servis_saatleri || {};
  const isYerleri = s.is_yerleri || [];
  const personelDetaylari = s.personel_detaylari || [];
  const ogunBilgileri = s.ogun_bilgileri || [];
  const birimFiyatlar = s.birim_fiyatlar || [];
  const maliKriterler = s.mali_kriterler || {};
  const teminatOranlari = s.teminat_oranlari || {};
  const cezaKosullari = s.ceza_kosullari || docAnalysis?.ceza_kosullari || [];
  const onemliNotlar = s.onemli_notlar || [];
  const gereliBelgeler = s.gerekli_belgeler || [];
  const fiyatFarki = s.fiyat_farki || {};
  const gramaj = s.gramaj || [];
  const teknikSartlar = s.teknik_sartlar || [];
  const eksikBilgiler = s.eksik_bilgiler || [];
  const benzerIsTanimi = s.benzer_is_tanimi || null;
  const sinirDegerKatsayisi = s.sinir_deger_katsayisi || null;
  const operasyonelKurallar = extractOperationalRules(onemliNotlar);
  const docDetails = s.document_details || [];

  // ── Güvenli sayısal dönüşüm (NaN koruması) ──
  function safeNumber(val) {
    if (val == null) return null;
    if (typeof val === 'number') return Number.isFinite(val) ? val : null;
    // "1.500.000 TL" gibi Türkçe formatlı stringleri temizle
    const cleaned = String(val)
      .replace(/[^\d.,-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function formatSafeBedel(val) {
    const num = safeNumber(val);
    if (num === null) return 'Belirtilmemiş';
    return `${num.toLocaleString('tr-TR')} TL`;
  }

  function formatSafeCount(val) {
    const num = safeNumber(val);
    if (num === null) return 'Bilinmiyor';
    return num.toLocaleString('tr-TR');
  }

  // ── Analiz edilen döküman bilgisi ──
  const docInfo =
    docDetails.length > 0
      ? docDetails.map((d) => `${d.filename} (${d.doc_type})`).join(', ')
      : `${docAnalysis?.dokuman_sayisi || 0} döküman`;

  // ── ORTAK İHALE BİLGİLERİ (tüm ajanlara gider) ──
  let prompt = `## İHALE BİLGİLERİ
- **Başlık:** ${tender.title || 'Bilinmiyor'}
- **Kurum:** ${tender.organization || 'Bilinmiyor'}
- **İl:** ${tender.city || 'Bilinmiyor'}
- **Tahmini Bedel:** ${formatSafeBedel(tahminiBedel)}
- **İhale Tarihi:** ${tender.tender_date || 'Bilinmiyor'}
- **İhale Türü:** ${ihaleTuru || 'Bilinmiyor'}
- **İhale Usulü:** ${ihaleUsulu || 'Bilinmiyor'}
- **Teklif Türü:** ${teklifTuru || 'Bilinmiyor'}
- **Sözleşme Süresi:** ${sure || 'Bilinmiyor'}
- **Toplam Personel:** ${formatSafeCount(kisiSayisi)}
- **Toplam Öğün Sayısı:** ${formatSafeCount(toplamOgun)}
- **İş Yerleri (${isYerleri.length}):** ${isYerleri.length > 0 ? isYerleri.join('; ') : 'Bilinmiyor'}
- **Analiz Edilen Dökümanlar:** ${docInfo}
`;

  // ── AGENT-SPESİFİK VERİ ENJEKSİYONU ──

  if (agentId === 'mevzuat') {
    prompt += `
## ŞARTNAME VERİLERİ (Mevzuat Analizi İçin)

### Operasyonel Kurallar
- **Alt Yüklenici:** ${operasyonelKurallar.alt_yuklenici || 'Bilgi yok'}
- **Muayene/Kabul:** ${operasyonelKurallar.muayene_kabul || 'Bilgi yok'}
- **Denetim:** ${operasyonelKurallar.denetim || 'Bilgi yok'}

### Gerekli Belgeler (${gereliBelgeler.length} adet)
${compactJson(gereliBelgeler, 15)}

### Ceza Koşulları (${cezaKosullari.length} adet)
${cezaKosullari.length > 0 ? compactJson(cezaKosullari) : 'Şartname/sözleşmede belirtilen cezalar analiz özütünde bulunamadı — bu önemli bir eksikliktir.'}

### Fiyat Farkı
${JSON.stringify(fiyatFarki, null, 1)}

### Teminat Oranları
${JSON.stringify(teminatOranlari, null, 1)}

### İş Artışı
${JSON.stringify(s.is_artisi || {}, null, 1)}

### Önemli Notlar & Hükümler (${onemliNotlar.length} adet)
${compactJson(onemliNotlar, 25)}

### Sözleşme & Şartname Hükümleri (mevzuat açısından)
${compactJson(
  teknikSartlar.filter((t) => {
    const kat = typeof t === 'object' ? t.kategori || '' : '';
    const madde = typeof t === 'object' ? (t.madde || '').toLowerCase() : '';
    return (
      kat.includes('belge') ||
      kat.includes('teminat') ||
      kat.includes('ceza') ||
      kat.includes('kisitlama') ||
      kat.includes('mali') ||
      kat.includes('fiyat') ||
      kat.includes('endeks') ||
      kat.includes('dil') ||
      kat.includes('teslim') ||
      madde.includes('fiyat fark') ||
      madde.includes('alt yüklenici') ||
      madde.includes('ceza')
    );
  }),
  25
)}
`;
  }

  if (agentId === 'maliyet') {
    // Birim fiyat cetveli vs personel detayları karşılaştırması
    const bfPersonelSayisi = birimFiyatlar.reduce((sum, bf) => {
      const miktar = Number.parseInt(bf.miktar, 10) || 0;
      return sum + miktar;
    }, 0);
    const bfAylikOrtalama = sure ? Math.round(bfPersonelSayisi / (Number.parseInt(sure, 10) || 24)) : null;
    const personelUyarisi =
      bfAylikOrtalama && kisiSayisi && Math.abs(bfAylikOrtalama - kisiSayisi) > kisiSayisi * 0.1
        ? `\n⚠️ **DİKKAT:** Birim fiyat cetvelindeki toplam miktar ${bfPersonelSayisi} kişi*ay (aylık ~${bfAylikOrtalama} kişi) ile personel detaylarındaki ${kisiSayisi} kişi arasında tutarsızlık var. Bu farkı analiz et.`
        : '';

    // Maliyet ajanı için finansal teknik şartlar (ödeme ve servis hükümleri dahil)
    const maliyetTeknikSartlar = teknikSartlar.filter((t) => {
      const kat = typeof t === 'object' ? t.kategori || '' : '';
      const madde = typeof t === 'object' ? (t.madde || '').toLowerCase() : '';
      return (
        kat.includes('mali') ||
        kat.includes('maliyet') ||
        kat.includes('fiyat') ||
        kat.includes('ceza') ||
        kat.includes('endeks') ||
        kat.includes('kisitlama') ||
        kat.includes('teminat') ||
        madde.includes('fiyat fark') ||
        madde.includes('ödeme') ||
        madde.includes('hakediş') ||
        madde.includes('hbys') ||
        madde.includes('bileklik') ||
        madde.includes('fatura') ||
        madde.includes('endeks')
      );
    });

    // Maliyet ajanı için finansal önemli notlar
    const maliyetNotlari = onemliNotlar.filter((n) => {
      const text = typeof n === 'object' ? (n.not || '').toLowerCase() : String(n).toLowerCase();
      const tur = typeof n === 'object' ? n.tur || '' : '';
      return (
        tur === 'kisitlama' ||
        text.includes('fiyat') ||
        text.includes('ödeme') ||
        text.includes('teminat') ||
        text.includes('ceza') ||
        text.includes('alt yüklenici') ||
        text.includes('maliyet') ||
        text.includes('ciro') ||
        text.includes('bilanço')
      );
    });

    prompt += `
## FİNANSAL VERİLER (Maliyet Analizi İçin)

### Temel Finansal Bilgiler
- **Tahmini Bedel:** ${tahminiBedel ? `${Number(tahminiBedel).toLocaleString('tr-TR')} TL` : 'Belirtilmemiş'}
- **İşçilik Oranı:** ${s.iscilik_orani || 'Belirtilmemiş'}
- **Sözleşme Süresi:** ${sure || 'Bilinmiyor'}
- **Toplam Personel (teknik şartname):** ${kisiSayisi || 'Bilinmiyor'}
- **Toplam Öğün Sayısı:** ${toplamOgun ? Number(toplamOgun).toLocaleString('tr-TR') : 'Bilinmiyor'}
- **İş Yeri Sayısı:** ${isYerleri.length}${personelUyarisi}

### Personel Detayları — Teknik Şartname (${personelDetaylari.length} pozisyon)
${compactJson(personelDetaylari)}

### Birim Fiyat Teklif Cetveli (${birimFiyatlar.length} kalem, toplam ${bfPersonelSayisi} kişi*ay)
${compactJson(birimFiyatlar, 25)}

### Öğün Dağılımı (Hastane/Lokasyon Bazlı)
${ogunBilgileri.length > 0 ? compactJson(ogunBilgileri) : 'Detaylı öğün dağılımı bulunamadı'}

### Mali Kriterler
${JSON.stringify(maliKriterler, null, 1)}

### Teminat Oranları
${JSON.stringify(teminatOranlari, null, 1)}

### Ödeme Koşulları
${JSON.stringify(s.odeme_kosullari || {}, null, 1)}

### Fiyat Farkı
${JSON.stringify(fiyatFarki, null, 1)}

### Servis Saatleri
${JSON.stringify(servisSaatleri, null, 1)}

### Finansal Hükümler & Kısıtlamalar (Sözleşme/Şartnameden)
${maliyetTeknikSartlar.length > 0 ? compactJson(maliyetTeknikSartlar, 15) : 'Bulunamadı'}

### Finansal Önemli Notlar
${maliyetNotlari.length > 0 ? compactJson(maliyetNotlari, 15) : 'Bulunamadı'}
`;
  }

  if (agentId === 'teknik') {
    // Birim fiyat vs personel tutarsızlığı teknik ajan için de hesapla
    const bfToplam = birimFiyatlar.reduce((sum, bf) => sum + (Number.parseInt(bf.miktar, 10) || 0), 0);
    const bfAylik = sure ? Math.round(bfToplam / (Number.parseInt(sure, 10) || 24)) : null;
    const teknikPersonelUyarisi =
      bfAylik && kisiSayisi && Math.abs(bfAylik - kisiSayisi) > kisiSayisi * 0.1
        ? `\n⚠️ **DİKKAT:** Birim fiyat cetvelinde aylık ~${bfAylik} kişi, teknik şartnamede ${kisiSayisi} kişi — tutarsızlık var.`
        : '';

    // Teknik ajan için operasyonel notlar
    const teknikNotlari = onemliNotlar.filter((n) => {
      const text = typeof n === 'object' ? (n.not || '').toLowerCase() : String(n).toLowerCase();
      const tur = typeof n === 'object' ? n.tur || '' : '';
      return (
        tur === 'kisitlama' ||
        tur === 'gereklilik' ||
        text.includes('personel') ||
        text.includes('ekipman') ||
        text.includes('hijyen') ||
        text.includes('kalite') ||
        text.includes('servis') ||
        text.includes('alt yüklenici') ||
        text.includes('işletme kayıt') ||
        text.includes('sertifika')
      );
    });

    prompt += `
## TEKNİK VERİLER (Teknik Yeterlilik Analizi İçin)

### Personel Detayları (${personelDetaylari.length} pozisyon, toplam ${kisiSayisi || '?'} kişi)
${compactJson(personelDetaylari)}${teknikPersonelUyarisi}

### Birim Fiyat Cetvelindeki Personel (karşılaştırma için)
${compactJson(birimFiyatlar, 15)}

### Öğün Bilgileri
- **Toplam Öğün:** ${toplamOgun ? Number(toplamOgun).toLocaleString('tr-TR') : 'Bilinmiyor'}
- **Günlük Öğün Sayısı:** ${s.gunluk_ogun_sayisi || 'Bilinmiyor'}
${ogunBilgileri.length > 0 ? `\n### Öğün Dağılımı (Hastane/Lokasyon Bazlı)\n${compactJson(ogunBilgileri)}` : ''}

### Gramaj Bilgileri (${gramaj.length} kalem)
${gramaj.length > 0 ? compactJson(gramaj, 40) : 'Gramaj bilgisi bulunamadı'}

### Teknik Şartlar (${teknikSartlar.length} madde)
${compactJson(teknikSartlar, 35)}

### Ekipman & Altyapı
- **Ekipman Listesi:** ${s.ekipman_listesi || 'Belirtilmemiş'}
- **Kalite Standartları:** ${s.kalite_standartlari || 'Belirtilmemiş'}
- **Mutfak Tipi:** ${s.mutfak_tipi || 'Belirtilmemiş'}

### Servis Bilgileri
- **Servis Saatleri:** ${JSON.stringify(servisSaatleri, null, 1)}
- **Servis Tipi:** ${s.servis_tipi || 'Belirtilmemiş'}
- **Sözleşme Süresi:** ${sure || 'Bilinmiyor'}
- **Kapasite Gereksinimi:** ${s.kapasite_gereksinimi || 'Bilinmiyor'}

### İş Yerleri (${isYerleri.length} lokasyon)
${isYerleri.length > 0 ? isYerleri.map((y, i) => `${i + 1}. ${y}`).join('\n') : 'Belirtilmemiş'}

### Operasyonel Notlar & Kısıtlamalar
${teknikNotlari.length > 0 ? compactJson(teknikNotlari, 15) : 'Bulunamadı'}
`;
  }

  if (agentId === 'rekabet') {
    prompt += `
## REKABET VERİLERİ (Rekabet İstihbaratı Analizi İçin)

### Rekabet Parametreleri
- **Sınır Değer Katsayısı:** ${sinirDegerKatsayisi || 'Bilinmiyor'}
- **Benzer İş Tanımı:** ${benzerIsTanimi || 'Tanımlanmamış'}
- **Teklif Türü:** ${teklifTuru || 'Bilinmiyor'}
- **İhale Usulü:** ${ihaleUsulu || 'Bilinmiyor'}
- **Tahmini Bedel:** ${tahminiBedel ? `${Number(tahminiBedel).toLocaleString('tr-TR')} TL` : 'Belirtilmemiş'}
- **Toplam Personel:** ${kisiSayisi || 'Bilinmiyor'}
- **Toplam Öğün:** ${toplamOgun ? Number(toplamOgun).toLocaleString('tr-TR') : 'Bilinmiyor'}
- **Sözleşme Süresi:** ${sure || 'Bilinmiyor'}
- **İş Yeri Sayısı:** ${isYerleri.length}

### Mali Kriterler (Rekabet Engeli Analizi İçin)
${JSON.stringify(maliKriterler, null, 1)}

### Gerekli Belgeler (Giriş Engeli Analizi)
${compactJson(gereliBelgeler, 15)}

### Birim Fiyat Kalemleri (İhale yapısı analizi)
${compactJson(birimFiyatlar, 15)}

### Eksik Bilgiler
${compactJson(eksikBilgiler)}

### Önemli Notlar & Kısıtlamalar
${compactJson(
  onemliNotlar.filter((n) => {
    const tur = typeof n === 'object' ? n.tur || '' : '';
    return tur === 'kisitlama' || tur === 'uyari' || tur === 'gereklilik';
  }),
  20
)}
`;
  }

  // ── DÖKÜMAN ANALİZLERİNDEN EK VERİ ──
  if (docAnalysis) {
    // Tam metin varsa ekle
    const tamMetin = docAnalysis.tam_metin || '';
    if (tamMetin.length > 0) {
      const kisaltilmis =
        tamMetin.length > 10000
          ? `${tamMetin.slice(0, 10000)}\n\n[...metin kısaltıldı, toplam ${tamMetin.length} karakter]`
          : tamMetin;
      prompt += `\n## DÖKÜMAN TAM METNİ (${docAnalysis.dokuman_sayisi} döküman)\n${kisaltilmis}\n`;
    }

    // Döküman özetleri
    if (docAnalysis.dokuman_ozetleri?.length > 0) {
      prompt += '\n## DÖKÜMAN ÖZETLERİ\n';
      for (const d of docAnalysis.dokuman_ozetleri) {
        prompt += `- **${d.dosya}** (${d.tur}): ${d.ozet}\n`;
      }
    }
  }

  // ── KNOWLEDGE BASE ──
  if (knowledgeItems.length > 0) {
    prompt += `\n## KAYNAK BİLGİLER (Agent Bilgi Tabanı)\n`;
    prompt +=
      'Aşağıdaki kaynaklar senin uzmanlık alanına özel referans materyalleridir. Analizinde bunları dikkate al:\n\n';

    for (const item of knowledgeItems) {
      const typeLabel = KNOWLEDGE_TYPE_LABELS[item.content_type] || 'Kaynak';
      prompt += `### ${typeLabel}: ${item.title || 'İsimsiz'}\n`;
      if (item.summary) prompt += `> ${item.summary}\n`;
      if (item.content) {
        const text = item.content.length > 2000 ? `${item.content.slice(0, 2000)}\n[...kısaltıldı]` : item.content;
        prompt += `${text}\n\n`;
      }
      if (item.tags?.length) prompt += `Etiketler: ${item.tags.join(', ')}\n\n`;
    }
  }

  // ── RING VERİSİ (kullanıcı eklemeleri — ajan bazlı filtreleme) ──
  if (ringData.length > 0) {
    // Öncelik 1: Bu ajana özel eklemeler (sourceAgent eşleşmesi veya sürükle-bırakla atanmış)
    const agentSpecific = ringData.filter((item) => item.sourceAgent === agentId);
    // Öncelik 2: Genel eklemeler (hiçbir ajana atanmamış)
    const general = ringData.filter((item) => !item.sourceAgent);
    // Birleştir: önce ajana özel, sonra genel
    const relevantRing = [...agentSpecific, ...general];

    if (relevantRing.length > 0) {
      const specificCount = agentSpecific.length;
      const generalCount = general.length;
      prompt += `\n## İHALEYE ÖZEL EK BİLGİLER (${specificCount} adet sana özel, ${generalCount} adet genel)\n`;
      prompt +=
        'Kullanıcılar bu ihale için aşağıdaki ek bilgileri eklemiştir. Özellikle sana atanmış olanları öncelikle dikkate al:\n\n';

      for (const item of relevantRing) {
        const typeLabel = RING_TYPE_LABELS[item.type] || 'Ek Bilgi';
        const agentTag = item.sourceAgent === agentId ? ' ⭐ (sana atanmış)' : '';
        prompt += `### ${typeLabel}: ${item.title || 'İsimsiz'}${agentTag}\n`;
        if (item.content) {
          const text = item.content.length > 1500 ? `${item.content.slice(0, 1500)}\n[...kısaltıldı]` : item.content;
          prompt += `${text}\n\n`;
        }
      }
    }
  }

  // ── ANALİZ TALİMATI ──
  prompt += `
## TALİMAT
Yukarıdaki ihale verilerini kendi uzmanlık alanın çerçevesinde analiz et.
Sadece sana verilen gerçek verilere dayanarak analiz yap. Veri olmayan konularda varsayımda bulunma, eksikliği raporla.

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER (başka hiçbir şey yazma):
{
  "findings": [
    {
      "label": "Bulgu başlığı (kısa, 5-10 kelime)",
      "value": "Detaylı açıklama (1-3 cümle)",
      "severity": "info | warning | critical",
      "confidence": 0.85,
      "reasoning": "Bu bulgunun neden önemli olduğunun kısa açıklaması"
    }
  ],
  "riskScore": 65,
  "summary": "Tek cümlelik genel değerlendirme",
  "keyRisks": ["En önemli risk 1", "En önemli risk 2"],
  "recommendations": ["Öneri 1", "Öneri 2"]
}

KURALLAR:
- findings dizisinde 4-12 arası bulgu olsun
- riskScore 0-100 arası (100 = çok riskli, 0 = risksiz). Veri yoksa veya eksikse 50 kullan
- severity dağılımı gerçekçi olsun (her şey critical olmasın)
- confidence: 0.0-1.0 arası, bulgunun kesinlik derecesi
- Veri eksikse bunu bir bulgu olarak raporla (severity: warning)
- SADECE JSON döndür, başka metin yazma
`;

  return prompt;
}

// ─── Tek Agent Analizi ───────────────────────────────────────

/**
 * Tek bir agent ile ihale analizi yap
 * @returns {Object} { success, analysis: { findings, riskScore, summary, ... } }
 */
async function analyzeWithAgent(tenderId, agentId, { force = false, additionalContext = null } = {}) {
  // 1. Cache kontrolü
  if (!force) {
    const cached = await getCachedAnalysis(tenderId, agentId);
    if (cached) {
      logger.debug(`[İhale Agent] Cache hit: tender=${tenderId}, agent=${agentId}`);
      return {
        success: true,
        cached: true,
        analysis: {
          id: cached.id,
          agentId,
          findings: cached.findings,
          riskScore: cached.risk_score,
          summary: cached.summary,
          status: 'complete',
          keyRisks: cached.key_risks,
          recommendations: cached.recommendations,
          model: cached.ai_model,
          createdAt: cached.created_at,
          version: cached.analysis_version,
        },
      };
    }
  }

  // 2. Pending kaydı oluştur
  const version = force
    ? (
        await query(
          `SELECT COALESCE(MAX(analysis_version), 0) + 1 as next
           FROM agent_analyses WHERE tender_id = $1 AND agent_id = $2`,
          [tenderId, agentId]
        )
      ).rows[0].next
    : 1;

  let analysisId;
  try {
    const insertResult = await query(
      `INSERT INTO agent_analyses (tender_id, agent_id, status, analysis_version)
       VALUES ($1, $2, 'analyzing', $3)
       ON CONFLICT (tender_id, agent_id, analysis_version)
       DO UPDATE SET status = 'analyzing', updated_at = NOW()
       RETURNING id`,
      [tenderId, agentId, version]
    );
    analysisId = insertResult.rows[0].id;
  } catch (err) {
    logger.error(`[İhale Agent] Insert hatası: ${err.message}`, { tenderId, agentId });
    return { success: false, error: 'Analiz kaydı oluşturulamadı' };
  }

  // 3. Veri yükle
  const tender = await loadTenderData(tenderId);
  if (!tender) {
    await query(`UPDATE agent_analyses SET status = 'error', error_message = 'İhale bulunamadı' WHERE id = $1`, [
      analysisId,
    ]);
    return { success: false, error: 'İhale bulunamadı' };
  }

  const analysisSummary = tender.analysis_summary || {};
  const [docAnalysis, agentConfig, knowledgeItems, ringData, pastLearning, sharedLearnings] = await Promise.all([
    loadDocumentAnalyses(tenderId),
    loadAgentConfig(agentId),
    loadAgentKnowledge(agentId),
    loadRingData(tenderId),
    getPastLearningSection(agentId),
    getSharedLearningsForAgent(agentId, 'ihale'),
  ]);

  // 4. Prompt oluştur — DB system prompt öncelikli, yoksa hardcoded fallback
  const systemPrompt = agentConfig?.system_prompt || AGENT_SYSTEM_PROMPTS[agentId];
  const agentModel = agentConfig?.model && agentConfig.model !== 'default' ? agentConfig.model : MODEL;
  const agentTemperature = Number(agentConfig?.temperature) || 0.3;
  let userMessage = buildAnalysisPrompt(agentId, tender, analysisSummary, docAnalysis, knowledgeItems, ringData);

  // 4b. Geçmiş ihale sonuçlarından öğrenme verisi ekle (few-shot örnekler)
  if (pastLearning) {
    userMessage += pastLearning;
  }

  // 4c. Diğer ajanlardan öğrenilen bilgileri ekle (cross-agent learning)
  if (sharedLearnings) {
    userMessage += sharedLearnings;
  }

  // Kullanıcı ek context'i (orbit ring notları, snippet'ler) varsa ekle
  if (additionalContext) {
    const agentNotes = additionalContext.notes || [];
    const agentSnippets = additionalContext.snippets?.[agentId] || additionalContext.snippets || [];

    if (agentNotes.length > 0 || agentSnippets.length > 0) {
      userMessage += '\n## KULLANICI NOTLARI VE SEÇİMLER\n';
      userMessage +=
        'Kullanıcı bu ihale ile ilgili aşağıdaki notları ve metin seçimlerini paylaştı. Bunları analizinde dikkate al:\n\n';

      if (agentNotes.length > 0) {
        userMessage += '### Notlar:\n';
        for (const note of agentNotes) {
          userMessage += `- ${note}\n`;
        }
        userMessage += '\n';
      }

      if (agentSnippets.length > 0) {
        userMessage += '### Seçili Metin Parçaları:\n';
        for (const snippet of agentSnippets) {
          userMessage += `> ${snippet}\n`;
        }
        userMessage += '\n';
      }
    }
  }

  const promptSource = agentConfig?.system_prompt ? 'database' : 'hardcoded';

  // 5. Claude API çağrısı
  try {
    logger.info(`[İhale Agent] Analiz başlıyor: tender=${tenderId}, agent=${agentId}`, {
      tenderId,
      agentId,
      hasDocAnalysis: !!docAnalysis,
      promptLength: userMessage.length,
      promptSource,
      knowledgeCount: knowledgeItems.length,
      ringCount: ringData.length,
      model: agentModel,
    });

    const response = await callClaudeWithRetry({
      model: agentModel,
      max_tokens: 4096,
      temperature: agentTemperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const aiText = textContent?.text || '';

    // 6. JSON parse
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      await query(`UPDATE agent_analyses SET status = 'error', error_message = 'JSON parse hatası' WHERE id = $1`, [
        analysisId,
      ]);
      return { success: false, error: 'AI yanıtı JSON formatında değil' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 7. Sonucu kaydet
    const riskScore = Math.max(0, Math.min(100, parsed.riskScore ?? 50));
    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    const summary = parsed.summary || '';
    const keyRisks = Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [];
    const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    await query(
      `UPDATE agent_analyses
       SET findings = $1, risk_score = $2, summary = $3, status = 'complete',
           key_risks = $4, recommendations = $5,
           ai_model = $6, prompt_tokens = $7, completion_tokens = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [
        JSON.stringify(findings),
        riskScore,
        summary,
        keyRisks,
        recommendations,
        agentModel,
        response.usage?.input_tokens || 0,
        response.usage?.output_tokens || 0,
        analysisId,
      ]
    );

    logger.info(`[İhale Agent] Analiz tamamlandı: tender=${tenderId}, agent=${agentId}, score=${riskScore}`, {
      tenderId,
      agentId,
      riskScore,
      findingCount: findings.length,
      tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    });

    return {
      success: true,
      cached: false,
      analysis: {
        id: analysisId,
        agentId,
        findings,
        riskScore,
        summary,
        status: 'complete',
        keyRisks,
        recommendations,
        model: agentModel,
        createdAt: new Date().toISOString(),
        version,
      },
    };
  } catch (error) {
    logger.error(`[İhale Agent] Claude API hatası: ${error.message}`, {
      tenderId,
      agentId,
      stack: error.stack,
    });

    await query(`UPDATE agent_analyses SET status = 'error', error_message = $1 WHERE id = $2`, [
      error.message?.slice(0, 500),
      analysisId,
    ]);

    return { success: false, error: `AI analiz hatası: ${error.message}` };
  }
}

// ─── Tüm Agent'ları Paralel Çalıştır ────────────────────────

const AGENT_IDS = ['mevzuat', 'maliyet', 'teknik', 'rekabet'];

async function analyzeAllAgents(tenderId, { force = false, additionalContext = null } = {}) {
  logger.info(`[İhale Agent] Tüm agent analizi başlıyor: tender=${tenderId}, force=${force}`);

  const results = await Promise.allSettled(
    AGENT_IDS.map((agentId) => analyzeWithAgent(tenderId, agentId, { force, additionalContext }))
  );

  const analyses = {};
  const errors = [];

  for (let i = 0; i < AGENT_IDS.length; i++) {
    const agentId = AGENT_IDS[i];
    const result = results[i];

    if (result.status === 'fulfilled' && result.value.success) {
      analyses[agentId] = result.value.analysis;
    } else {
      const errorMsg = result.status === 'rejected' ? result.reason?.message : result.value?.error;
      errors.push({ agentId, error: errorMsg || 'Bilinmeyen hata' });
      analyses[agentId] = {
        agentId,
        findings: [],
        riskScore: 0,
        summary: `Analiz tamamlanamadi: ${errorMsg || 'Bilinmeyen hata'}`,
        status: 'error',
        keyRisks: [],
        recommendations: [],
      };
    }
  }

  logger.info(`[İhale Agent] Tüm agent analizi tamamlandı: tender=${tenderId}`, {
    completed: AGENT_IDS.length - errors.length,
    errors: errors.length,
  });

  return { success: true, analyses, errors };
}

// ─── Cache'den Yükleme ──────────────────────────────────────

async function loadCachedAnalyses(tenderId) {
  // Stale-check: karşılaştır cache created_at vs tender_tracking.last_analysis_at
  // Eğer analiz özütü cache'den sonra güncellendiyse, cache eski demektir
  const staleCheck = await query(
    `SELECT tt.last_analysis_at, tt.updated_at
     FROM tender_tracking tt
     WHERE tt.tender_id = $1
     LIMIT 1`,
    [tenderId]
  );
  const trackingRow = staleCheck.rows[0];
  const trackingUpdatedAt = trackingRow?.last_analysis_at || trackingRow?.updated_at;

  const result = await query(
    `SELECT DISTINCT ON (agent_id)
       id, agent_id, findings, risk_score, summary, status,
       key_risks, recommendations, ai_model, created_at, analysis_version
     FROM agent_analyses
     WHERE tender_id = $1 AND status = 'complete'
     ORDER BY agent_id, analysis_version DESC`,
    [tenderId]
  );

  if (result.rows.length === 0) return null;

  // Check if any cache entry is older than the tracking data update
  if (trackingUpdatedAt) {
    const trackingTime = new Date(trackingUpdatedAt).getTime();
    const oldestCache = Math.min(...result.rows.map((r) => new Date(r.created_at).getTime()));
    if (oldestCache < trackingTime) {
      logger.info(
        `[İhale Agent] Cache stale: cache=${new Date(oldestCache).toISOString()}, tracking=${new Date(trackingTime).toISOString()}, tender=${tenderId}`
      );
      return null; // Cache eski — yeni analiz tetiklenecek
    }
  }

  const analyses = {};
  for (const row of result.rows) {
    analyses[row.agent_id] = {
      id: row.id,
      agentId: row.agent_id,
      findings: row.findings,
      riskScore: row.risk_score,
      summary: row.summary,
      status: row.status,
      keyRisks: row.key_risks,
      recommendations: row.recommendations,
      model: row.ai_model,
      createdAt: row.created_at,
      version: row.analysis_version,
    };
  }

  return analyses;
}

// ─── AI Verdict (Akıllı Karar) ──────────────────────────────

const VERDICT_SYSTEM_PROMPT = `Sen kamu ihale alanında 20 yıllık deneyime sahip kıdemli bir strateji danışmanısın.
Görevin: 4 uzman ajanın (mevzuat, maliyet, teknik, rekabet) ihale analiz bulgularını sentezleyerek ihaleye giriş kararı vermek.

Senin rolün uzmanların bireysel analizlerini bütünsel bir bakış açısıyla değerlendirmek, çapraz riskleri tespit etmek ve net bir karar vermektir.`;

/**
 * Tüm agent bulgularını toplayıp AI ile akıllı verdict üret
 * @param {number} tenderId
 * @param {Object} analyses - { mevzuat: {...}, maliyet: {...}, ... }
 * @param {Object} tenderInfo - İhale temel bilgileri
 * @returns {Object} { recommendation, score, reasoning, checklist, crossReferences }
 */
async function generateAIVerdict(tenderId, analyses, tenderInfo = {}) {
  // Agent bulgularını prompt'a hazırla
  let agentSummary = '';

  for (const [agentId, analysis] of Object.entries(analyses)) {
    const agentName =
      {
        mevzuat: 'Mevzuat & Sözleşme',
        maliyet: 'Maliyet & Bütçe',
        teknik: 'Teknik Yeterlilik',
        rekabet: 'Rekabet İstihbaratı',
      }[agentId] || agentId;

    agentSummary += `\n### ${agentName} (Risk Skoru: ${analysis.riskScore}/100)\n`;
    agentSummary += `**Özet:** ${analysis.summary}\n`;

    if (analysis.findings?.length) {
      agentSummary += '**Bulgular:**\n';
      for (const f of analysis.findings) {
        agentSummary += `- [${f.severity?.toUpperCase()}] ${f.label}: ${f.value}\n`;
      }
    }

    if (analysis.keyRisks?.length) {
      agentSummary += `**Anahtar Riskler:** ${analysis.keyRisks.join('; ')}\n`;
    }
    if (analysis.recommendations?.length) {
      agentSummary += `**Öneriler:** ${analysis.recommendations.join('; ')}\n`;
    }
  }

  const userPrompt = `## İHALE BİLGİLERİ
- **Başlık:** ${tenderInfo.title || 'Bilinmiyor'}
- **Kurum:** ${tenderInfo.organization || 'Bilinmiyor'}
- **Tahmini Bedel:** ${tenderInfo.estimated_cost || 'Belirtilmemiş'}
- **İhale Tarihi:** ${tenderInfo.tender_date || 'Bilinmiyor'}

## UZMAN AJAN BULGULARI
${agentSummary}

## TALİMAT
Yukarıdaki 4 uzmanın bulgularını sentezle ve aşağıdaki JSON formatında karar ver:

{
  "recommendation": "gir | dikkat | girme",
  "recommendationLabel": "Kısa açıklama (1 cümle)",
  "overallScore": 0-100,
  "reasoning": "2-4 cümle detaylı gerekçe",
  "checklist": [
    {
      "id": "benzersiz_id",
      "label": "Kontrol maddesi",
      "status": "pass | fail | unknown",
      "detail": "Detay açıklama",
      "severity": "critical | warning | info"
    }
  ],
  "crossReferences": [
    {
      "fromAgentId": "mevzuat",
      "toAgentId": "maliyet",
      "fromFinding": "Bulgu adı",
      "impact": "Etki açıklaması",
      "severity": "critical | warning | info"
    }
  ],
  "strategicNotes": "Stratejik öneriler (2-3 cümle)"
}

KURALLAR:
- recommendation: "gir" (skor>=70), "dikkat" (45-70), "girme" (<45)
- checklist'te 8-12 arası kontrol maddesi olsun
- crossReferences'ta agent'lar arası en az 3 çapraz etki belirt
- Gerçekçi ve ölçülü değerlendir, ne çok iyimser ne çok karamsar ol
- SADECE JSON döndür`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.2,
      system: VERDICT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const aiText = textContent?.text || '';

    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('[İhale Agent] Verdict JSON parse hatası — regex match yok');
      return { success: false, error: 'AI verdict parse hatası' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    logger.info(
      `[İhale Agent] AI Verdict üretildi: tender=${tenderId}, recommendation=${parsed.recommendation}, score=${parsed.overallScore}`
    );

    return {
      success: true,
      verdict: {
        recommendation: parsed.recommendation || 'dikkat',
        recommendationLabel: parsed.recommendationLabel || 'Değerlendirme gerekli',
        overallScore: parsed.overallScore ?? 50,
        reasoning: parsed.reasoning || '',
        checklist: parsed.checklist || [],
        crossReferences: parsed.crossReferences || [],
        strategicNotes: parsed.strategicNotes || '',
        generatedAt: new Date().toISOString(),
        generatedBy: 'ai',
      },
    };
  } catch (err) {
    logger.error(`[İhale Agent] Verdict hatası: ${err.message}`);
    return { success: false, error: `Verdict hatası: ${err.message}` };
  }
}

// ─── Export ──────────────────────────────────────────────────

export default {
  analyzeWithAgent,
  analyzeAllAgents,
  loadCachedAnalyses,
  generateAIVerdict,
  loadRingData,
  AGENT_IDS,
};
