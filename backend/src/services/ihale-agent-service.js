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

// ─── Anthropic Client ────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-5-20250929'; // Analiz için sonnet yeterli, maliyet/hız dengesi

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
    [tenderId],
  );
  return result.rows[0] || null;
}

/**
 * İhale döküman analizlerini yükle (documents tablosu → combined analysis)
 */
async function loadDocumentAnalyses(tenderId) {
  const docsResult = await query(
    `SELECT original_filename, doc_type, analysis_result
     FROM documents
     WHERE tender_id = $1 AND analysis_result IS NOT NULL
     ORDER BY doc_type, created_at`,
    [tenderId],
  );

  if (docsResult.rows.length === 0) return null;

  const combined = {
    teknik_sartlar: [],
    birim_fiyatlar: [],
    notlar: [],
    tam_metin: '',
    dokuman_sayisi: docsResult.rows.length,
  };

  for (const doc of docsResult.rows) {
    const analysis = doc.analysis_result || {};
    if (Array.isArray(analysis.teknik_sartlar)) {
      combined.teknik_sartlar.push(...analysis.teknik_sartlar);
    }
    if (Array.isArray(analysis.birim_fiyatlar)) {
      combined.birim_fiyatlar.push(...analysis.birim_fiyatlar);
    }
    if (Array.isArray(analysis.notlar)) {
      combined.notlar.push(...analysis.notlar);
    }
    if (analysis.tam_metin) {
      combined.tam_metin += `\n--- ${doc.original_filename} ---\n${analysis.tam_metin}`;
    }
  }

  // Deduplicate
  combined.teknik_sartlar = [...new Set(combined.teknik_sartlar)];
  combined.notlar = [...new Set(combined.notlar)];

  return combined;
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
      [agentId],
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
      [agentId],
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
    [tenderId, agentId],
  );
  return result.rows[0] || null;
}

// ─── Analiz Prompt Oluşturucu ────────────────────────────────

function buildAnalysisPrompt(agentId, tender, analysisSummary, docAnalysis, knowledgeItems = []) {
  const summary = analysisSummary || {};

  // Ortak ihale bilgileri
  let prompt = `## İHALE BİLGİLERİ
- **Başlık:** ${tender.title || 'Bilinmiyor'}
- **Kurum:** ${tender.organization || 'Bilinmiyor'}
- **İl:** ${tender.city || 'Bilinmiyor'}
- **Tahmini Bedel:** ${tender.estimated_cost || summary.tahmini_bedel || 'Belirtilmemiş'}
- **İhale Tarihi:** ${tender.tender_date || 'Bilinmiyor'}
- **İhale Usulü:** ${summary.ihale_usulu || 'Bilinmiyor'}
- **Teklif Türü:** ${summary.teklif_turu || 'Bilinmiyor'}
`;

  // Agent-spesifik veri enjeksiyonu
  if (agentId === 'mevzuat') {
    prompt += `
## ŞARTNAME VERİLERİ (Mevzuat İçin)
- **İhale Türü:** ${summary.ihale_turu || 'Bilinmiyor'}
- **Alt Yüklenici:** ${summary.operasyonel_kurallar?.alt_yuklenici || 'Bilgi yok'}
- **Muayene Kabul:** ${summary.operasyonel_kurallar?.muayene_kabul || 'Bilgi yok'}
- **Denetim:** ${summary.operasyonel_kurallar?.denetim || 'Bilgi yok'}
- **Gerekli Belgeler:** ${JSON.stringify(summary.gerekli_belgeler || [], null, 1)}
- **Ceza Koşulları:** ${JSON.stringify(summary.ceza_kosullari || [], null, 1)}
- **İş Artışı:** ${JSON.stringify(summary.is_artisi || {}, null, 1)}
- **Fiyat Farkı:** ${JSON.stringify(summary.fiyat_farki || {}, null, 1)}
- **Teminat Oranları:** ${JSON.stringify(summary.teminat_oranlari || {}, null, 1)}
`;
  }

  if (agentId === 'maliyet') {
    prompt += `
## FİNANSAL VERİLER (Maliyet İçin)
- **Tahmini Bedel:** ${summary.tahmini_bedel || 'Belirtilmemiş'}
- **İşçilik Oranı:** ${summary.iscilik_orani || 'Belirtilmemiş'}
- **Birim Fiyatlar:** ${JSON.stringify((summary.birim_fiyatlar || []).slice(0, 20), null, 1)}
- **Mali Kriterler:** ${JSON.stringify(summary.mali_kriterler || {}, null, 1)}
- **Teminat Oranları:** ${JSON.stringify(summary.teminat_oranlari || {}, null, 1)}
- **Ödeme Koşulları:** ${JSON.stringify(summary.odeme_kosullari || {}, null, 1)}
- **Kişi Sayısı:** ${summary.kisi_sayisi || 'Bilinmiyor'}
- **Süre:** ${summary.sure || summary.teslim_suresi || 'Bilinmiyor'}
`;
  }

  if (agentId === 'teknik') {
    prompt += `
## TEKNİK VERİLER
- **Teknik Şartlar:** ${JSON.stringify((summary.teknik_sartlar || []).slice(0, 30), null, 1)}
- **Personel Detayları:** ${JSON.stringify(summary.personel_detaylari || [], null, 1)}
- **Kişi Sayısı:** ${summary.kisi_sayisi || 'Bilinmiyor'}
- **Öğün Bilgileri:** ${JSON.stringify(summary.ogun_bilgileri || [], null, 1)}
- **Ekipman Listesi:** ${summary.ekipman_listesi || 'Bilgi yok'}
- **Kalite Standartları:** ${summary.kalite_standartlari || 'Bilgi yok'}
- **Servis Saatleri:** ${JSON.stringify(summary.servis_saatleri || {}, null, 1)}
- **Süre:** ${summary.sure || summary.teslim_suresi || 'Bilinmiyor'}
- **Kapasite Gereksinimi:** ${summary.kapasite_gereksinimi || 'Bilinmiyor'}
`;
  }

  if (agentId === 'rekabet') {
    prompt += `
## REKABET VERİLERİ
- **Sınır Değer Katsayısı:** ${summary.sinir_deger_katsayisi || 'Bilinmiyor'}
- **Benzer İş Tanımı:** ${summary.benzer_is_tanimi || 'Tanımlanmamış'}
- **Teklif Türü:** ${summary.teklif_turu || 'Bilinmiyor'}
- **İhale Usulü:** ${summary.ihale_usulu || 'Bilinmiyor'}
- **Mali Kriterler:** ${JSON.stringify(summary.mali_kriterler || {}, null, 1)}
- **Eksik Bilgiler:** ${JSON.stringify(summary.eksik_bilgiler || [], null, 1)}
- **Önemli Notlar:** ${JSON.stringify(summary.onemli_notlar || [], null, 1)}
`;
  }

  // Döküman analizleri varsa ekle (tam metin çok uzun olabilir, sınırlayalım)
  if (docAnalysis) {
    const tamMetin = docAnalysis.tam_metin || '';
    const kısaltılmış = tamMetin.length > 8000 ? tamMetin.slice(0, 8000) + '\n\n[...metin kısaltıldı]' : tamMetin;

    if (kısaltılmış) {
      prompt += `
## DÖKÜMAN TAM METNİ (${docAnalysis.dokuman_sayisi} döküman)
${kısaltılmış}
`;
    }
  }

  // Knowledge base (emsal kararlar, notlar, referans dökümanlar)
  if (knowledgeItems.length > 0) {
    prompt += `\n## KAYNAK BİLGİLER (Agent Bilgi Tabanı)\n`;
    prompt += `Aşağıdaki kaynaklar senin uzmanlık alanına özel referans materyalleridir. Analizinde bunları dikkate al:\n\n`;

    for (const item of knowledgeItems) {
      const typeLabel = {
        note: 'Not',
        past_analysis: 'Geçmiş Analiz',
        template: 'Şablon',
        url: 'Web Kaynağı',
        pdf: 'Döküman',
      }[item.content_type] || 'Kaynak';

      prompt += `### ${typeLabel}: ${item.title || 'İsimsiz'}\n`;
      if (item.summary) prompt += `> ${item.summary}\n`;
      if (item.content) {
        const text = item.content.length > 2000
          ? item.content.slice(0, 2000) + '\n[...kısaltıldı]'
          : item.content;
        prompt += `${text}\n\n`;
      }
      if (item.tags?.length) prompt += `Etiketler: ${item.tags.join(', ')}\n\n`;
    }
  }

  // Analiz talimatı
  prompt += `
## TALİMAT
Yukarıdaki ihale verilerini kendi uzmanlık alanın çerçevesinde analiz et.

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
          [tenderId, agentId],
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
      [tenderId, agentId, version],
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
  const [docAnalysis, agentConfig, knowledgeItems] = await Promise.all([
    loadDocumentAnalyses(tenderId),
    loadAgentConfig(agentId),
    loadAgentKnowledge(agentId),
  ]);

  // 4. Prompt oluştur — DB system prompt öncelikli, yoksa hardcoded fallback
  const systemPrompt = agentConfig?.system_prompt || AGENT_SYSTEM_PROMPTS[agentId];
  const agentModel = (agentConfig?.model && agentConfig.model !== 'default') ? agentConfig.model : MODEL;
  const agentTemperature = Number(agentConfig?.temperature) || 0.3;
  let userMessage = buildAnalysisPrompt(agentId, tender, analysisSummary, docAnalysis, knowledgeItems);

  // Kullanıcı ek context'i (orbit ring notları, snippet'ler) varsa ekle
  if (additionalContext) {
    const agentNotes = additionalContext.notes || [];
    const agentSnippets = additionalContext.snippets?.[agentId] || additionalContext.snippets || [];

    if (agentNotes.length > 0 || agentSnippets.length > 0) {
      userMessage += '\n## KULLANICI NOTLARI VE SEÇİMLER\n';
      userMessage += 'Kullanıcı bu ihale ile ilgili aşağıdaki notları ve metin seçimlerini paylaştı. Bunları analizinde dikkate al:\n\n';

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
      model: agentModel,
    });

    const response = await client.messages.create({
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
      await query(
        `UPDATE agent_analyses SET status = 'error', error_message = 'JSON parse hatası' WHERE id = $1`,
        [analysisId],
      );
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
        MODEL,
        response.usage?.input_tokens || 0,
        response.usage?.output_tokens || 0,
        analysisId,
      ],
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
        model: MODEL,
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
    AGENT_IDS.map((agentId) => analyzeWithAgent(tenderId, agentId, { force, additionalContext })),
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
        riskScore: 50,
        summary: 'Analiz tamamlanamadı',
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
  const result = await query(
    `SELECT DISTINCT ON (agent_id)
       id, agent_id, findings, risk_score, summary, status,
       key_risks, recommendations, ai_model, created_at, analysis_version
     FROM agent_analyses
     WHERE tender_id = $1 AND status = 'complete'
     ORDER BY agent_id, analysis_version DESC`,
    [tenderId],
  );

  if (result.rows.length === 0) return null;

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
    const agentName = { mevzuat: 'Mevzuat & Sözleşme', maliyet: 'Maliyet & Bütçe', teknik: 'Teknik Yeterlilik', rekabet: 'Rekabet İstihbaratı' }[agentId] || agentId;

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

    logger.info(`[İhale Agent] AI Verdict üretildi: tender=${tenderId}, recommendation=${parsed.recommendation}, score=${parsed.overallScore}`);

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
  AGENT_IDS,
};
