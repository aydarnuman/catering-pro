/**
 * Yüklenici AI İstihbarat Raporu Servisi
 * ────────────────────────────────────────
 * Claude Opus 4.6 ile kapsamlı firma istihbarat raporu üretir.
 *
 * Diğer tüm istihbarat modüllerinin çıktılarını (ihale geçmişi, haberler,
 * KİK yasaklılar, şirket bilgileri, profil analizi, katılımcılar) birleştirerek
 * tek bir derinlemesine istihbarat değerlendirmesi oluşturur.
 *
 * Kullanım senaryosu:
 *   "Bu firma ile aynı ihaleye giriyoruz. Ne bilmeliyiz?"
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import { logAPI, logError } from '../utils/logger.js';

const MODULE_NAME = 'AI-Istihbarat';
const MODEL = 'claude-opus-4-6';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Yüklenici istihbarat raporu oluşturur.
 * Tüm modül verilerini toplayıp Opus 4.6'ya gönderir.
 */
export async function generateIstihbaratRaporu(yukleniciId) {
  const startTime = Date.now();
  logAPI(MODULE_NAME, 'rapor_olustur', { yukleniciId, model: MODEL });

  try {
    // ─── 1. Tüm verileri topla ─────────────────────────────────

    // Yüklenici temel bilgileri
    const {
      rows: [yuklenici],
    } = await query(
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
      `SELECT ihale_basligi AS ihale_adi, kurum_adi AS idare, sehir, durum, rol,
              sozlesme_bedeli, indirim_orani, sozlesme_tarihi
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1
       ORDER BY sozlesme_tarihi DESC NULLS LAST
       LIMIT 50`,
      [yukleniciId]
    );

    // Rakipler (ortak ihale sayısına göre)
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
      `SELECT ihale_basligi AS ihale_adi, durum, created_at
       FROM yuklenici_ihaleleri
       WHERE yuklenici_id = $1 AND rol = 'kik_karari'
       ORDER BY created_at DESC LIMIT 20`,
      [yukleniciId]
    );

    // ─── 2. Diğer modüllerin verilerini çek ───────────────────

    const { rows: modulVerileri } = await query(
      `SELECT modul, veri, hata_mesaji, durum
       FROM yuklenici_istihbarat
       WHERE yuklenici_id = $1 AND durum = 'tamamlandi' AND veri IS NOT NULL`,
      [yukleniciId]
    );

    const modulMap = {};
    for (const m of modulVerileri) {
      modulMap[m.modul] = m.veri;
    }

    // ─── 3. İstihbarat prompt'unu oluştur ─────────────────────

    const prompt = buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar, modulMap);

    // ─── 4. Claude Opus 4.6'dan rapor iste ────────────────────

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiText = response.content[0]?.text || '';

    // ─── 5. Sonucu yapılandır ─────────────────────────────────

    const rapor = parseAiResponse(aiText);

    const result = {
      rapor,
      ham_metin: aiText,
      olusturulma_tarihi: new Date().toISOString(),
      model: MODEL,
      sure_ms: Date.now() - startTime,
      veri_kaynagi_ozeti: {
        ihaleSayisi: ihaleler.length,
        rakipSayisi: rakipler.length,
        kikKararSayisi: kikKararlar.length,
        modulVerisi: Object.keys(modulMap),
      },
    };

    logAPI(MODULE_NAME, 'rapor_tamamlandi', {
      yukleniciId,
      basarili: true,
      sure_ms: result.sure_ms,
      model: MODEL,
    });
    return result;
  } catch (error) {
    logError(MODULE_NAME, error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// Prompt Builder
// ═══════════════════════════════════════════════════════════════

function buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar, modulMap) {
  const fmt = (val) => {
    if (!val) return '-';
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // ── Sistem talimatı ──
  let prompt = `Sen bir kamu ihale istihbarat analistisin. Yemek/catering sektöründe faaliyet gösteren bir firmanın rakip analizini yapıyorsun.

GÖREV: Aşağıdaki ham verileri analiz ederek, bu firmayla AYNI İHALEYE GİRECEK bir catering şirketinin karar vericisine sunulacak kısa ve vurucu bir İSTİHBARAT BRİFİNGİ hazırla.

ÖNEMLİ KURALLAR:
- Bu bir SWOT analizi DEĞİL. Bu bir istihbarat dosyasıdır.
- Genel/jenerik ifadeler YASAK. Sadece verideki somut rakamları ve bulguları kullan.
- Her tespitin yanına kaynak veriyi belirt (örn: "23 fesih — sektör ortalamasının 4 katı").
- Firmanın gerçek davranış kalıplarını ortaya koy: nerede agresif, nerede zayıf?
- Raporu okuyan kişi 2 dakikada firmanın profilini kavrayabilmeli.

RAPOR FORMATI (bu başlıkları kullan):

## ÖZET PROFIL
(1-2 cümle: Firma kim, ne yapıyor, ne kadar büyük)

## TEHLİKE SEVİYESİ: [DÜŞÜK / ORTA / YÜKSEK / ÇOK YÜKSEK]
(1 cümle gerekçe)

## FAALİYET ALANI
- Aktif olduğu şehirler ve bölgeler
- Uzmanlaştığı ihale türleri
- İş hacmi ve büyüme trendi

## İHALE DAVRANIŞI
- Ortalama indirim oranı ve fiyatlama stratejisi
- Kazanma oranı ve başarı kalıbı
- En çok hangi kurumlara/şehirlere teklif veriyor
- Agresif mi, muhafazakar mı?

## RİSK SİNYALLERİ
- Fesih geçmişi (sayı + yorum)
- KİK şikayetleri ve kararlar
- Yasaklı durumu
- Haberlerdeki olumsuz bilgiler (varsa)
- Şirket kayıt durumu (MERSİS / Ticaret Sicil)

## RAKİP AĞIR
- En sık karşılaşılan rakipleri
- Hangi firmalara karşı kazanıyor/kaybediyor

## STRATEJİK TAVSİYELER
(Bu firmayla aynı ihaleye girerken dikkat edilecek 3-5 somut öneri)
`;

  // ── Firma bilgileri ──
  prompt += `
═══════════════════════════════════════
FİRMA: ${yuklenici.unvan}
${yuklenici.kisa_ad ? `Kısa Ad: ${yuklenici.kisa_ad}` : ''}
═══════════════════════════════════════

İHALE İSTATİSTİKLERİ:
  Katıldığı ihale: ${yuklenici.katildigi_ihale_sayisi || '?'}
  Kazanma oranı: ${yuklenici.kazanma_orani ? `%${yuklenici.kazanma_orani}` : '?'}
  Toplam sözleşme: ${fmt(yuklenici.toplam_sozlesme_bedeli)}
  Ort. indirim: ${yuklenici.ortalama_indirim_orani ? `%${yuklenici.ortalama_indirim_orani}` : '?'}
  Son ihale: ${yuklenici.son_ihale_tarihi || '?'}

RİSK GÖSTERGELERİ:
  Fesih sayısı: ${yuklenici.fesih_sayisi || 0}
  KİK şikayet: ${yuklenici.kik_sikayet_sayisi || 0}
  Risk notu: ${yuklenici.risk_notu || 'belirtilmemiş'}

COĞRAFİ DAĞILIM:
  ${JSON.stringify(yuklenici.aktif_sehirler || [], null, 0)}

ETİKETLER: ${(yuklenici.etiketler || []).join(', ') || '-'}
`;

  // ── İhale geçmişi ──
  if (ihaleler.length > 0) {
    prompt += `\n═══ SON İHALELER (${ihaleler.length} adet) ═══\n`;
    for (const ih of ihaleler.slice(0, 25)) {
      const parts = [
        ih.ihale_adi || '?',
        ih.idare || '',
        ih.sehir || '',
        ih.durum || '',
        ih.rol,
        ih.indirim_orani ? `indirim:%${ih.indirim_orani}` : '',
        ih.sozlesme_bedeli ? `bedel:${fmt(ih.sozlesme_bedeli)}` : '',
        ih.sozlesme_tarihi || '',
      ].filter(Boolean);
      prompt += `• ${parts.join(' | ')}\n`;
    }
  }

  // ── Rakipler ──
  if (rakipler.length > 0) {
    prompt += `\n═══ EN SIK KARŞILAŞILAN RAKİPLER ═══\n`;
    for (const r of rakipler) {
      prompt += `• ${r.unvan}: ${r.ortak_ihale_sayisi} ortak ihale\n`;
    }
  }

  // ── KİK kararları ──
  if (kikKararlar.length > 0) {
    prompt += `\n═══ KİK KARARLARI (${kikKararlar.length} adet) ═══\n`;
    for (const k of kikKararlar) {
      prompt += `• ${k.ihale_adi || '?'} | ${k.durum || '-'}\n`;
    }
  }

  // ── Diğer modül verileri ──

  // Haberler
  if (modulMap.haberler) {
    const haberler = modulMap.haberler;
    if (haberler.haberler && haberler.haberler.length > 0) {
      prompt += `\n═══ BASINDA ÇIKAN HABERLER (${haberler.toplam || haberler.haberler.length} adet) ═══\n`;
      for (const h of haberler.haberler.slice(0, 10)) {
        prompt += `• [${h.tarih_okunur || '?'}] ${h.baslik} (${h.kaynak || '?'})\n`;
      }
    }
  }

  // KİK Yasaklılar
  if (modulMap.kik_yasaklilar) {
    const yas = modulMap.kik_yasaklilar;
    prompt += `\n═══ KİK YASAKLI DURUMU ═══\n`;
    prompt += `Yasaklı mı: ${yas.yasakli_mi ? 'EVET ⚠️' : 'Hayır'}\n`;
    if (yas.sonuclar && yas.sonuclar.length > 0) {
      for (const s of yas.sonuclar) {
        prompt += `• ${JSON.stringify(s)}\n`;
      }
    }
  }

  // Şirket bilgileri
  if (modulMap.sirket_bilgileri) {
    const sb = modulMap.sirket_bilgileri;
    prompt += `\n═══ ŞİRKET KAYIT BİLGİLERİ ═══\n`;
    if (sb.mersis) {
      prompt += `MERSİS: ${sb.mersis.basarili ? 'Kayıt bulundu' : 'Kayıt bulunamadı / Erişim hatası'}\n`;
      if (sb.mersis.bilgiler) prompt += `  ${JSON.stringify(sb.mersis.bilgiler)}\n`;
    }
    if (sb.ticaret_sicil) {
      prompt += `Ticaret Sicil: ${sb.ticaret_sicil.basarili ? 'Kayıt bulundu' : 'Erişim hatası'}\n`;
      if (sb.ticaret_sicil.ilanlar?.length > 0) {
        for (const ilan of sb.ticaret_sicil.ilanlar.slice(0, 5)) {
          prompt += `  • ${JSON.stringify(ilan)}\n`;
        }
      }
    }
  }

  // Profil analizi
  if (modulMap.profil_analizi) {
    const profil = modulMap.profil_analizi;
    if (profil.bolum_sayisi) {
      prompt += `\n═══ İHALEBUL.COM PROFİL ANALİZİ ═══\n`;
      prompt += `${profil.bolum_sayisi} bölüm veri mevcut\n`;
    }
  }

  // ihalebul.com analiz verisi (yukleniciler tablosundan)
  if (yuklenici.analiz_verisi?.ozet) {
    prompt += `\n═══ İHALEBUL.COM İSTATİSTİK ÖZETİ ═══\n`;
    prompt += JSON.stringify(yuklenici.analiz_verisi.ozet, null, 2);
  }

  return prompt;
}

// ═══════════════════════════════════════════════════════════════
// Response Parser
// ═══════════════════════════════════════════════════════════════

function parseAiResponse(text) {
  const rapor = {
    ozet_profil: '',
    tehlike_seviyesi: 'orta',
    tehlike_gerekce: '',
    faaliyet_alani: '',
    ihale_davranisi: '',
    risk_sinyalleri: '',
    rakip_agi: '',
    stratejik_tavsiyeler: [],
    tam_metin: text,
  };

  try {
    // ## veya # başlıklarıyla bölümlere ayır (--- ayırıcıları da temizle)
    const sections = text.split(/^#{1,3}\s+/m).filter(Boolean);

    for (const section of sections) {
      const firstLine = section.split('\n')[0].trim();
      const lower = firstLine.toLowerCase().replace(/[*_#`]/g, '');
      // Başlık satırını kaldırarak içeriği al, --- ayırıcılarını da temizle
      const content = section
        .replace(/^[^\n]*\n/, '')
        .replace(/^---+\s*/gm, '')
        .trim();

      if (lower.includes('özet profil') || lower.includes('ozet profil')) {
        rapor.ozet_profil = content;
      } else if (lower.includes('tehlike')) {
        if (lower.includes('çok yüksek') || lower.includes('cok yuksek')) {
          rapor.tehlike_seviyesi = 'çok yüksek';
        } else if (lower.includes('yüksek') || lower.includes('yuksek')) {
          rapor.tehlike_seviyesi = 'yüksek';
        } else if (lower.includes('düşük') || lower.includes('dusuk')) {
          rapor.tehlike_seviyesi = 'düşük';
        } else {
          rapor.tehlike_seviyesi = 'orta';
        }
        rapor.tehlike_gerekce = content;
      } else if (lower.includes('faaliyet')) {
        rapor.faaliyet_alani = content;
      } else if (lower.includes('ihale davranı') || lower.includes('ihale davranis')) {
        rapor.ihale_davranisi = content;
      } else if (lower.includes('risk sinyal') || lower.includes('risk gösterge')) {
        rapor.risk_sinyalleri = content;
      } else if (lower.includes('rakip') || lower.includes('rekabet')) {
        rapor.rakip_agi = content;
      } else if (lower.includes('stratejik') || lower.includes('tavsiye') || lower.includes('öneri')) {
        rapor.stratejik_tavsiyeler = extractBullets(content);
        // Tavsiye alanında metin de olabilir
        if (rapor.stratejik_tavsiyeler.length === 0 && content.length > 0) {
          rapor.stratejik_tavsiyeler = [content];
        }
      }
    }
  } catch {
    rapor.ozet_profil = text;
  }

  return rapor;
}

function extractBullets(text) {
  return text
    .split('\n')
    .filter((l) => l.trim().match(/^[-•*\d]/))
    .map((l) =>
      l
        .replace(/^[-•*]\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim()
    )
    .filter((l) => l.length > 0);
}
