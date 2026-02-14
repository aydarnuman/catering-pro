/**
 * AI Route Yardımcı Fonksiyonları
 * ai.js route dosyasından ayrıştırılmış utility fonksiyonlar
 */

import { query } from '../database.js';
import logger from '../utils/logger.js';
import { IHALE_AGENT_SYSTEM_PROMPTS_FALLBACK } from './ai-prompts.js';

// ==========================================
// İHALE MASASI — Agent & Tool Prompt Helpers
// ==========================================

/**
 * Fetch agent system prompt from database (with fallback to hardcoded)
 */
export async function getAgentSystemPrompt(agentSlug) {
  try {
    const result = await query(`SELECT id, system_prompt FROM agents WHERE slug = $1 AND is_active = true`, [
      agentSlug,
    ]);
    if (result.rows.length > 0 && result.rows[0].system_prompt) {
      return { agentId: result.rows[0].id, systemPrompt: result.rows[0].system_prompt };
    }
  } catch (error) {
    logger.warn(`[İhale Masası] Agent DB lookup failed for ${agentSlug}:`, error.message);
  }
  // Fallback to hardcoded
  const fallback = IHALE_AGENT_SYSTEM_PROMPTS_FALLBACK[agentSlug];
  return fallback ? { agentId: null, systemPrompt: fallback } : null;
}

/**
 * Fetch tool ai_prompt_template from database
 */
export async function getToolPromptTemplate(agentDbId, toolSlug) {
  if (!agentDbId) return null;
  try {
    const result = await query(
      `SELECT ai_prompt_template FROM agent_tools WHERE agent_id = $1 AND tool_slug = $2 AND is_active = true`,
      [agentDbId, toolSlug]
    );
    if (result.rows.length > 0 && result.rows[0].ai_prompt_template) {
      return result.rows[0].ai_prompt_template;
    }
  } catch (error) {
    logger.warn(`[İhale Masası] Tool DB lookup failed for ${toolSlug}:`, error.message);
  }
  return null;
}

/**
 * Substitute variables in database prompt template
 */
export function substitutePromptVariables(template, input, context) {
  const ctx = context || {};

  // Replace {{input}} with the user input
  let prompt = template.replace(/\{\{input\}\}/g, input || '');

  // Replace {{context}} with full context JSON
  prompt = prompt.replace(/\{\{context\}\}/g, JSON.stringify(ctx, null, 2));

  // Replace specific context variables like {{ihale_basligi}}, {{tahmini_bedel}}, etc.
  const contextKeys = [
    'ihale_basligi',
    'kurum',
    'il',
    'tahmini_bedel',
    'ihale_usulu',
    'kisi_sayisi',
    'sure',
    'kapasite_gereksinimi',
    'benzer_is_tanimi',
    'teklif_turu',
    'sinir_deger_katsayisi',
  ];

  for (const key of contextKeys) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(regex, ctx[key] || 'Belirtilmemiş');
  }

  // Replace JSON array context variables
  const jsonArrayKeys = [
    'ogun_bilgileri',
    'birim_fiyatlar',
    'personel_detaylari',
    'teknik_sartlar',
    'servis_saatleri',
    'teminat_oranlari',
  ];

  for (const key of jsonArrayKeys) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(regex, JSON.stringify(ctx[key] || [], null, 2));
  }

  // Replace {{date}} with current date
  prompt = prompt.replace(/\{\{date\}\}/g, new Date().toLocaleDateString('tr-TR'));

  return prompt;
}

/**
 * Build tool prompt - uses database template if available, falls back to hardcoded
 */
export function buildToolPrompt(toolId, input, context, dbTemplate = null) {
  const ctx = context || {};

  // If we have a database template, use variable substitution
  if (dbTemplate) {
    return substitutePromptVariables(dbTemplate, input, ctx);
  }

  // Fallback to hardcoded prompts
  switch (toolId) {
    case 'redline':
      return `Aşağıdaki ihale şartname maddesini teklif veren lehine revize et. Orijinal metni, revize metni ve değişiklik gerekçesini ayrı ayrı belirt.

Orijinal Madde:
"${input || ''}"

İhale Bilgileri:
${JSON.stringify(ctx, null, 2)}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "redline",
  "originalText": "orijinal madde metni",
  "revisedText": "revize edilmiş metin",
  "explanation": "değişiklik gerekçesi ve hukuki dayanaklar"
}`;

    case 'emsal':
      return `Bu ihale şartnamesi konusuyla ilgili KİK kararları ve Danıştay içtihatlarını ara. Emsal kararları önem sırasına göre listele.

İhale Konusu: ${ctx.ihale_basligi || ''}
İhale Usulü: ${ctx.ihale_usulu || ''}
Araştırma Konusu: ${input || 'Genel şartname analizi'}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "precedent",
  "citations": [
    {
      "reference": "KİK Kararı veya Danıştay kararı referans numarası",
      "summary": "Kararın özeti ve ilgisi",
      "relevance": "Yüksek/Orta/Düşük"
    }
  ]
}`;

    case 'zeyilname':
      return `Bu ihale için idareye resmi zeyilname talep mektubu hazırla. Hukuki dayanakları ve talep edilen değişiklikleri belirt.

İhale: ${ctx.ihale_basligi || ''}
Kurum: ${ctx.kurum || ''}
Konu: ${input || 'Genel şartname itirazı'}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "draft",
  "draftTitle": "mektup başlığı",
  "addressee": "hitap",
  "draftDate": "${new Date().toLocaleDateString('tr-TR')}",
  "draftBody": "mektup tam metni"
}`;

    case 'maliyet_hesapla':
      return `Bu ihale şartnamesindeki menü/yemek gereksinimlerine göre tahmini maliyet hesabı yap.

İhale: ${ctx.ihale_basligi || ''}
Tahmini Bedel: ${ctx.tahmini_bedel || 'Belirtilmemiş'}
Kişi Sayısı: ${ctx.kisi_sayisi || 'Belirtilmemiş'}
Süre: ${ctx.sure || 'Belirtilmemiş'}
Öğün Bilgileri: ${JSON.stringify(ctx.ogun_bilgileri || [], null, 2)}
Birim Fiyatlar: ${JSON.stringify(ctx.birim_fiyatlar || [], null, 2)}
${input ? `Ek Not: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "detaylı maliyet hesabı (markdown formatında)"
}`;

    case 'piyasa_karsilastir':
      return `Bu ihale için piyasa fiyat karşılaştırması yap. Şartnamedeki birim fiyatları güncel piyasa ile karşılaştır.

Birim Fiyatlar: ${JSON.stringify(ctx.birim_fiyatlar || [], null, 2)}
Tahmini Bedel: ${ctx.tahmini_bedel || 'Belirtilmemiş'}
${input ? `Özel Analiz: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "piyasa karşılaştırma analizi (markdown formatında)"
}`;

    case 'teminat_hesapla':
      return `Bu ihale için teminat hesaplaması yap.

Tahmini Bedel: ${ctx.tahmini_bedel || 'Belirtilmemiş'}
Geçici Teminat: ${ctx.teminat_oranlari?.gecici || ctx.teminat_oranlari?.gecici_teminat || '%3'}
Kesin Teminat: ${ctx.teminat_oranlari?.kesin || ctx.teminat_oranlari?.kesin_teminat || '%6'}
${input ? `Ek: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "calculation",
  "content": "teminat hesaplama detayları (markdown formatında)"
}`;

    case 'personel_karsilastir':
      return `İhale şartnamesindeki personel gereksinimlerini analiz et ve firmanın mevcut kadrosuyla karşılaştırma önerisi yap.

Şartnamedeki Personel Gereksinimleri: ${JSON.stringify(ctx.personel_detaylari || [], null, 2)}
Kişi Sayısı: ${ctx.kisi_sayisi || 'Belirtilmemiş'}
${input ? `Ek Not: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "personel analizi ve öneriler (markdown formatında)"
}`;

    case 'menu_uygunluk':
      return `İhale şartnamesindeki menü/yemek gereksinimlerini değerlendir.

Öğün Bilgileri: ${JSON.stringify(ctx.ogun_bilgileri || [], null, 2)}
Teknik Şartlar: ${JSON.stringify((ctx.teknik_sartlar || []).slice(0, 10), null, 2)}
Servis Saatleri: ${JSON.stringify(ctx.servis_saatleri || {}, null, 2)}
${input ? `Ek Not: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "menü uygunluk analizi (markdown formatında)"
}`;

    case 'kapasite_kontrol':
      return `İhale için kapasite yeterlilik analizi yap.

Kişi Sayısı: ${ctx.kisi_sayisi || 'Belirtilmemiş'}
Süre: ${ctx.sure || 'Belirtilmemiş'}
Öğün Bilgileri: ${JSON.stringify(ctx.ogun_bilgileri || [], null, 2)}
Kapasite Gereksinimi: ${ctx.kapasite_gereksinimi || 'Belirtilmemiş'}
${input ? `Ek Not: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "kapasite analizi ve değerlendirme (markdown formatında)"
}`;

    case 'benzer_ihale':
      return `Bu ihaleye benzer geçmiş ihaleleri analiz et ve rekabet durumunu değerlendir.

İhale: ${ctx.ihale_basligi || ''}
Kurum: ${ctx.kurum || ''}
İl: ${ctx.il || ''}
Tahmini Bedel: ${ctx.tahmini_bedel || 'Belirtilmemiş'}
İhale Usulü: ${ctx.ihale_usulu || ''}
${input ? `Ek: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "rekabet analizi ve strateji önerileri (markdown formatında)"
}`;

    case 'teklif_stratejisi':
      return `Bu ihale için optimal teklif stratejisi öner.

Tahmini Bedel: ${ctx.tahmini_bedel || 'Belirtilmemiş'}
Sınır Değer Katsayısı: ${ctx.sinir_deger_katsayisi || 'Belirtilmemiş'}
Teklif Türü: ${ctx.teklif_turu || 'Belirtilmemiş'}
Benzer İş Tanımı: ${ctx.benzer_is_tanimi || 'Belirtilmemiş'}
${input ? `Ek Bilgi: ${input}` : ''}

YANITINI TAM OLARAK ŞU JSON FORMATINDA VER:
{
  "type": "generic",
  "content": "teklif stratejisi analizi (markdown formatında, senaryolu)"
}`;

    default:
      return input || 'Bu ihale hakkında genel bir değerlendirme yap.';
  }
}

/**
 * Parse AI response to structured ToolResult
 */
export function parseAIResponseToToolResult(aiResponse, _toolId) {
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure type field exists
      if (!parsed.type) {
        parsed.type = 'generic';
      }
      return { success: true, result: parsed };
    }
    return {
      success: true,
      result: { type: 'generic', content: aiResponse },
    };
  } catch (_e) {
    return {
      success: true,
      result: { type: 'generic', content: aiResponse },
    };
  }
}

// ==========================================
// İHALE MASASI — Malzeme Eşleştirme Helpers
// ==========================================

/**
 * Porsiyon maliyeti hesapla (gramaj x birim fiyat, birim dönüşümlü)
 */
export function hesaplaPorsiyonMaliyet(fiyat, birim, gramaj, gramajBirim) {
  if (!fiyat || !gramaj) return null;
  const b = (birim || '').toLowerCase();
  let maliyet = 0;

  if (b === 'kg') {
    maliyet = (fiyat / 1000) * gramaj;
  } else if (b === 'lt' || b === 'litre') {
    maliyet = (fiyat / 1000) * gramaj;
  } else if (b === 'adet') {
    const adet = gramajBirim === 'adet' ? gramaj : gramaj / 60;
    maliyet = fiyat * adet;
  } else if (b === 'demet') {
    maliyet = fiyat * (gramaj / 50);
  } else if (b === 'gr') {
    maliyet = fiyat > 10 ? (fiyat / 1000) * gramaj : fiyat * gramaj;
  } else {
    maliyet = (fiyat / 1000) * gramaj;
  }

  return Math.round(maliyet * 100) / 100;
}

/**
 * sample_menus tablolarından yemek tariflerini çıkar.
 * Her tablo: headers[0]="Yemek Adı:", headers[1]="Yemek İsmi"
 * Satırlar: [malzeme, gramaj, ...besin değerleri]
 */
export function parseRecipesFromSampleMenus(sampleMenus) {
  const recipes = [];
  for (const table of sampleMenus) {
    const headers = table.headers || [];
    // Yemek tarifi tablosu mu?
    if (headers[0] !== 'Yemek Adı:' || !headers[1]) continue;

    const name = headers[1].trim();
    if (!name) continue;

    const ingredients = [];
    let totalGramaj = null;

    for (const row of table.rows || []) {
      if (!row || row.length < 2) continue;
      const itemName = (row[0] || '').trim();
      const gramajStr = (row[1] || '').trim();

      // Başlık satırı atla
      if (itemName.toLowerCase() === 'malzemeler' || itemName.toLowerCase() === 'malzeme') continue;

      // Toplam satırı
      if (itemName.toLowerCase() === 'toplam') {
        totalGramaj = Number.parseFloat(gramajStr) || null;
        continue;
      }

      if (!itemName) continue;
      const gramaj = Number.parseFloat(gramajStr) || null;

      ingredients.push({
        item: itemName,
        gramaj,
        unit: 'g',
      });
    }

    if (ingredients.length > 0) {
      recipes.push({ name, ingredients, totalGramaj, category: null });
    }
  }
  return recipes;
}

/**
 * Fallback: gramaj listesindeki "Toplam" satırlarını ayırıcı olarak kullanarak
 * yemek grupları oluştur. gramaj_gruplari varsa onları kullan.
 */
export function parseRecipesFromGramaj(gramaj, gramajGruplari) {
  // Önce gramaj_gruplari varsa onu kullan
  if (gramajGruplari && gramajGruplari.length > 0) {
    return gramajGruplari.map((g) => ({
      name: g.yemek_adi || 'Bilinmeyen Yemek',
      category: g.kategori || null,
      totalGramaj: g.toplam_gramaj || null,
      ingredients: (g.malzemeler || []).map((m) => ({
        item: m.item,
        gramaj: typeof m.weight === 'number' ? m.weight : Number.parseFloat(String(m.weight)) || null,
        unit: m.unit || 'g',
      })),
    }));
  }

  // Fallback: Toplam satırlarını ayırıcı olarak kullan
  const recipes = [];
  let currentIngredients = [];
  let recipeIndex = 1;

  for (const g of gramaj) {
    const item = (g.item || '').trim();
    if (!item) continue;

    if (item.toLowerCase() === 'toplam') {
      if (currentIngredients.length > 0) {
        const totalGramaj = Number.parseFloat(String(g.weight)) || null;
        recipes.push({
          name: `Yemek ${recipeIndex}`,
          category: null,
          totalGramaj,
          ingredients: currentIngredients,
        });
        currentIngredients = [];
        recipeIndex++;
      }
      continue;
    }

    currentIngredients.push({
      item,
      gramaj: typeof g.weight === 'number' ? g.weight : Number.parseFloat(String(g.weight)) || null,
      unit: g.unit || 'g',
    });
  }

  // Son grubu da ekle
  if (currentIngredients.length > 0) {
    recipes.push({
      name: `Yemek ${recipeIndex}`,
      category: null,
      totalGramaj: null,
      ingredients: currentIngredients,
    });
  }

  return recipes;
}
