/**
 * Yüklenici AI İstihbarat Raporu Servisi
 * ────────────────────────────────────────
 * Bir yüklenicinin tüm mevcut verilerini (ihale geçmişi, analiz, katılımcılar,
 * KİK kararları) toplayarak Claude AI'dan kapsamlı bir istihbarat raporu oluşturur.
 *
 * Bu modül:
 *   - Veritabanından yüklenici verilerini toplar
 *   - Verileri yapılandırılmış bir prompt'a dönüştürür
 *   - Claude AI'dan detaylı analiz raporu ister
 *   - Sonucu yapılandırılmış JSON olarak döner
 *
 * Dönen veri formatı:
 * {
 *   rapor: {
 *     genel_degerlendirme: string,
 *     guclü_yonler: string[],
 *     zayif_yonler: string[],
 *     firsatlar: string[],
 *     tehditler: string[],
 *     rekabet_stratejisi: string,
 *     fiyat_analizi: string,
 *     tavsiyeler: string[],
 *     risk_seviyesi: "düşük" | "orta" | "yüksek"
 *   },
 *   olusturulma_tarihi: ISO string,
 *   model: string,
 *   veri_kaynagi_ozeti: { ... }
 * }
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const MODULE_NAME = 'AI-Istihbarat';

// AI istemcisi (Claude)
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Yüklenici istihbarat raporu oluşturur.
 * @param {number} yukleniciId - Yüklenici ID
 * @returns {Object} AI tarafından oluşturulan istihbarat raporu
 */
export async function generateIstihbaratRaporu(yukleniciId) {
  const startTime = Date.now();
  logger.logAPI(MODULE_NAME, { yukleniciId, action: 'rapor_olustur' });

  try {
    // ─── 1. Verileri topla ───────────────────────────────────────

    // Yüklenici temel bilgileri
    const { rows: [yuklenici] } = await query(
      `SELECT id, unvan, kisa_ad, katildigi_ihale_sayisi, kazanma_orani,
              toplam_sozlesme_bedeli, ortalama_indirim_orani, aktif_sehirler,
              fesih_sayisi, kik_sikayet_sayisi, risk_notu, analiz_verisi,
              son_ihale_tarihi, etiketler
       FROM yukleniciler WHERE id = $1`,
      [yukleniciId]
    );

    if (!yuklenici) throw new Error('Yüklenici bulunamadı');

    // Son 50 ihalesi
    const { rows: ihaleler } = await query(
      `SELECT ihale_adi, idare, sehir, durum, rol, sozlesme_bedeli,
              indirim_orani, sozlesme_tarihi
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1
       ORDER BY sozlesme_tarihi DESC NULLS LAST
       LIMIT 50`,
      [yukleniciId]
    );

    // Katılımcı verisi (hangi firmayla sık karşılaşıyor)
    const { rows: rakipler } = await query(
      `SELECT y.unvan, COUNT(*) as ortak_ihale_sayisi
       FROM yuklenici_ihaleleri yi1
       JOIN yuklenici_ihaleleri yi2 ON yi1.tender_id = yi2.tender_id
         AND yi1.yuklenici_id != yi2.yuklenici_id
       JOIN yukleniciler y ON y.id = yi2.yuklenici_id
       WHERE yi1.yuklenici_id = $1
       GROUP BY y.unvan
       ORDER BY ortak_ihale_sayisi DESC
       LIMIT 10`,
      [yukleniciId]
    );

    // KIK kararları
    const { rows: kikKararlar } = await query(
      `SELECT ihale_adi, durum, created_at
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1 AND rol = 'kik_karari'
       ORDER BY created_at DESC LIMIT 10`,
      [yukleniciId]
    );

    // ─── 2. AI Prompt oluştur ────────────────────────────────────

    const veriOzeti = {
      ihaleSayisi: ihaleler.length,
      rakipSayisi: rakipler.length,
      kikKararSayisi: kikKararlar.length,
      analizMevcut: !!yuklenici.analiz_verisi,
    };

    const prompt = buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar);

    // ─── 3. Claude AI'dan rapor iste ─────────────────────────────

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiText = response.content[0]?.text || '';

    // ─── 4. Yanıtı yapılandır ───────────────────────────────────

    const rapor = parseAiResponse(aiText);

    const result = {
      rapor,
      ham_metin: aiText, // Debug ve UI gösterimi için
      olusturulma_tarihi: new Date().toISOString(),
      model: 'claude-3-haiku-20240307',
      sure_ms: Date.now() - startTime,
      veri_kaynagi_ozeti: veriOzeti,
    };

    logger.logAPI(MODULE_NAME, { yukleniciId, basarili: true, sure_ms: result.sure_ms });
    return result;
  } catch (error) {
    logger.logError(MODULE_NAME, error);
    throw error;
  }
}

/**
 * AI prompt'unu oluşturur.
 * Tüm veriyi okunabilir şekilde yapılandırır.
 */
function buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar) {
  const formatBedel = (val) => {
    if (!val) return 'Bilinmiyor';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);
  };

  let prompt = `Sen bir kamu ihale istihbarat uzmanısın. Aşağıdaki verileri analiz ederek kapsamlı bir yüklenici istihbarat raporu hazırla.

RAPORU TÜRKÇE OLARAK VE AŞAĞIDAKİ BÖLÜMLERLE OLUŞTUR:

1. GENEL DEĞERLENDİRME (2-3 paragraf)
2. GÜÇLÜ YÖNLER (madde madde)
3. ZAYIF YÖNLER (madde madde)
4. FIRSATLAR (madde madde)
5. TEHDİTLER (madde madde)
6. REKABET STRATEJİSİ (1-2 paragraf)
7. FİYAT ANALİZİ (indirim oranları ve teklif davranışı)
8. TAVSİYELER (bu firmayla rekabet etmek için öneriler)
9. RİSK SEVİYESİ (düşük/orta/yüksek ve nedeni)

═══ FİRMA BİLGİLERİ ═══
Ünvan: ${yuklenici.unvan}
Katıldığı İhale Sayısı: ${yuklenici.katildigi_ihale_sayisi || 'Bilinmiyor'}
Kazanma Oranı: ${yuklenici.kazanma_orani ? `%${yuklenici.kazanma_orani}` : 'Bilinmiyor'}
Toplam Sözleşme Bedeli: ${formatBedel(yuklenici.toplam_sozlesme_bedeli)}
Ortalama İndirim Oranı: ${yuklenici.ortalama_indirim_orani ? `%${yuklenici.ortalama_indirim_orani}` : 'Bilinmiyor'}
Aktif Şehirler: ${JSON.stringify(yuklenici.aktif_sehirler || [])}
Fesih Sayısı: ${yuklenici.fesih_sayisi || 0}
KİK Şikayet Sayısı: ${yuklenici.kik_sikayet_sayisi || 0}
Son İhale Tarihi: ${yuklenici.son_ihale_tarihi || 'Bilinmiyor'}
Etiketler: ${(yuklenici.etiketler || []).join(', ') || 'Yok'}
Risk Notu: ${yuklenici.risk_notu || 'Belirtilmemiş'}`;

  // İhale geçmişi
  if (ihaleler.length > 0) {
    prompt += `\n\n═══ SON İHALELER (${ihaleler.length} adet) ═══\n`;
    for (const ih of ihaleler.slice(0, 20)) {
      prompt += `- ${ih.ihale_adi || 'İsimsiz'} | ${ih.idare || ''} | ${ih.sehir || ''} | ${ih.durum || ''} | ${ih.rol} | İndirim: ${ih.indirim_orani ? `%${ih.indirim_orani}` : '-'} | Bedel: ${formatBedel(ih.sozlesme_bedeli)} | Tarih: ${ih.sozlesme_tarihi || '-'}\n`;
    }
  }

  // Rakipler
  if (rakipler.length > 0) {
    prompt += `\n═══ EN SIK KARŞILAŞILAN RAKİPLER ═══\n`;
    for (const r of rakipler) {
      prompt += `- ${r.unvan}: ${r.ortak_ihale_sayisi} ortak ihale\n`;
    }
  }

  // KİK kararları
  if (kikKararlar.length > 0) {
    prompt += `\n═══ KİK KARARLARI (${kikKararlar.length} adet) ═══\n`;
    for (const k of kikKararlar) {
      prompt += `- ${k.ihale_adi || 'İsimsiz'} | Durum: ${k.durum || '-'}\n`;
    }
  }

  // Analiz verisi
  if (yuklenici.analiz_verisi?.ozet) {
    prompt += `\n═══ İHALEBUL.COM ANALİZ ÖZETİ ═══\n`;
    prompt += JSON.stringify(yuklenici.analiz_verisi.ozet, null, 2);
  }

  return prompt;
}

/**
 * AI yanıtını yapılandırılmış nesneye dönüştürür.
 * Bölüm başlıklarını arayarak parse eder.
 */
function parseAiResponse(text) {
  const rapor = {
    genel_degerlendirme: '',
    guclu_yonler: [],
    zayif_yonler: [],
    firsatlar: [],
    tehditler: [],
    rekabet_stratejisi: '',
    fiyat_analizi: '',
    tavsiyeler: [],
    risk_seviyesi: 'orta', // varsayılan
  };

  try {
    // Bölümleri regex ile ayır
    const sections = text.split(/\d+\.\s+/);

    for (const section of sections) {
      const lower = section.toLowerCase();

      if (lower.includes('genel değerlendirme') || lower.includes('genel degerlendirme')) {
        rapor.genel_degerlendirme = cleanSection(section);
      } else if (lower.includes('güçlü') || lower.includes('guclu')) {
        rapor.guclu_yonler = extractBullets(section);
      } else if (lower.includes('zayıf') || lower.includes('zayif')) {
        rapor.zayif_yonler = extractBullets(section);
      } else if (lower.includes('fırsat') || lower.includes('firsat')) {
        rapor.firsatlar = extractBullets(section);
      } else if (lower.includes('tehdit')) {
        rapor.tehditler = extractBullets(section);
      } else if (lower.includes('rekabet')) {
        rapor.rekabet_stratejisi = cleanSection(section);
      } else if (lower.includes('fiyat')) {
        rapor.fiyat_analizi = cleanSection(section);
      } else if (lower.includes('tavsiye') || lower.includes('öneri')) {
        rapor.tavsiyeler = extractBullets(section);
      } else if (lower.includes('risk')) {
        rapor.risk_seviyesi = extractRiskLevel(section);
      }
    }
  } catch {
    // Parse hatası olursa ham metni genel değerlendirme olarak kullan
    rapor.genel_degerlendirme = text;
  }

  return rapor;
}

function cleanSection(text) {
  return text
    .replace(/^[^:]*:\s*/m, '') // Başlık satırını temizle
    .trim();
}

function extractBullets(text) {
  const lines = text.split('\n');
  return lines
    .filter(l => l.trim().startsWith('-') || l.trim().startsWith('•') || l.trim().match(/^\d+\./))
    .map(l => l.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(l => l.length > 0);
}

function extractRiskLevel(text) {
  const lower = text.toLowerCase();
  if (lower.includes('yüksek') || lower.includes('yuksek')) return 'yüksek';
  if (lower.includes('düşük') || lower.includes('dusuk')) return 'düşük';
  return 'orta';
}
