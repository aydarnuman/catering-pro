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
import { getCachedHavuz } from './yuklenici-veri-havuzu.js';

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
    // ─── 1. Yüklenici temel bilgileri (önce bu — Tavily'ye unvan lazım) ──
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

    // ─── 2. HER ŞEYİ PARALEL BAŞLAT (DB + Havuz okuma) ────────
    const dbStartTime = Date.now();

    // Tüm DB sorguları + veri havuzu okuma aynı anda
    const [ihaleResult, rakipResult, kikResult, modulResult, havuzVeri] = await Promise.all([
      // DB: İhaleler
      query(
        `SELECT ihale_basligi AS ihale_adi, kurum_adi AS idare, sehir, ilce, durum, rol,
                sozlesme_bedeli, yaklasik_maliyet, indirim_orani, sozlesme_tarihi,
                is_baslangic, is_bitis, is_suresi, ihale_niteligi,
                toplam_teklif_sayisi, gecerli_teklif_sayisi,
                en_yuksek_teklif, en_dusuk_teklif,
                fesih_durumu, kisim_adi, veri_kaynagi
         FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1
         ORDER BY sozlesme_tarihi DESC NULLS LAST
         LIMIT 200`,
        [yukleniciId]
      ),
      // DB: Rakipler
      query(
        `SELECT y.unvan, COUNT(*) as ortak_ihale_sayisi
         FROM yuklenici_ihaleleri yi1
         JOIN yuklenici_ihaleleri yi2 ON yi1.tender_id = yi2.tender_id
           AND yi1.yuklenici_id != yi2.yuklenici_id
         JOIN yukleniciler y ON y.id = yi2.yuklenici_id
         WHERE yi1.yuklenici_id = $1
         GROUP BY y.unvan
         ORDER BY ortak_ihale_sayisi DESC
         LIMIT 30`,
        [yukleniciId]
      ),
      // DB: KİK kararları
      query(
        `SELECT ihale_basligi AS ihale_adi, kurum_adi AS idare, sehir, durum,
                sozlesme_bedeli, sozlesme_tarihi, created_at
         FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1 AND rol = 'kik_karari'
         ORDER BY created_at DESC LIMIT 50`,
        [yukleniciId]
      ),
      // DB: Modül verileri (veri_havuzu dahil)
      query(
        `SELECT modul, veri, hata_mesaji, durum
         FROM yuklenici_istihbarat
         WHERE yuklenici_id = $1 AND durum = 'tamamlandi' AND veri IS NOT NULL`,
        [yukleniciId]
      ),
      // Veri Havuzu: persist edilmiş web istihbarat verisi
      getCachedHavuz(yukleniciId).catch(() => null),
    ]);

    const ihaleler = ihaleResult.rows;
    const rakipler = rakipResult.rows;
    const kikKararlar = kikResult.rows;

    const modulMap = {};
    for (const m of modulResult.rows) {
      modulMap[m.modul] = m.veri;
    }

    // Web istihbaratını havuzdan oku — eski format'a dönüştür (prompt uyumu)
    let webIstihbarat = null;
    if (havuzVeri?.web_istihbarat) {
      const wi = havuzVeri.web_istihbarat;
      webIstihbarat = {
        webSonuclari: wi.ihale_sonuclari || [],
        aiOzet: wi.ai_ozet || null,
        kikKararMetinleri: wi.kik_sonuclari || [],
        haberSonuclari: wi.haber_sonuclari || [],
        haberOzet: wi.haber_ozet || null,
        sicilSonuclari: wi.sicil_sonuclari || [],
        tamMetinler: havuzVeri.tam_metinler || [],
      };
      logAPI(MODULE_NAME, 'havuz_verisi_okundu', {
        yukleniciId,
        toplam_sonuc: havuzVeri.meta?.sonuc_toplam || 0,
        tam_metin: havuzVeri.meta?.tam_metin_sayisi || 0,
      });
    } else {
      logAPI(MODULE_NAME, 'havuz_verisi_yok', { yukleniciId, mesaj: 'veri_havuzu çalışmamış veya süresi dolmuş' });
    }

    logAPI(MODULE_NAME, 'veri_toplama_suresi', {
      yukleniciId,
      sure_ms: Date.now() - dbStartTime,
      havuzdan: !!webIstihbarat,
    });

    // ─── 4. İstihbarat prompt'unu oluştur ─────────────────────

    // Çapraz kontrol verisini havuzdan al (varsa)
    const caprazKontrol = havuzVeri?.capraz_kontrol || null;

    const prompt = buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar, modulMap, webIstihbarat, caprazKontrol);

    // ─── 5. Claude Opus 4.6'dan rapor iste ────────────────────

    // Prompt boyutunu logla
    logAPI(MODULE_NAME, 'prompt_boyutu', {
      yukleniciId,
      karakter: prompt.length,
      tahminiToken: Math.round(prompt.length / 3),
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    });

    const aiText = response.content[0]?.text || '';

    // ─── 6. Sonucu yapılandır ─────────────────────────────────

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
        havuzdan: !!webIstihbarat,
        tavilyWebSonuc: webIstihbarat?.webSonuclari?.length || 0,
        tavilyKikSonuc: webIstihbarat?.kikKararMetinleri?.length || 0,
        tavilyHaberSonuc: webIstihbarat?.haberSonuclari?.length || 0,
        tavilySicilSonuc: webIstihbarat?.sicilSonuclari?.length || 0,
        tavilyTamMetin: webIstihbarat?.tamMetinler?.length || 0,
        caprazKontrol: {
          coopetition: caprazKontrol?.coopetition?.length || 0,
          rakipEslesmeler: caprazKontrol?.rakip_ihale_eslesmeler?.length || 0,
        },
        promptKarakter: prompt.length,
        promptTahminiToken: Math.round(prompt.length / 3),
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: karmaşık prompt builder, refactor planlanıyor
function buildPrompt(yuklenici, ihaleler, rakipler, kikKararlar, modulMap, webIstihbarat, caprazKontrol) {
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
- Aşağıda BİRDEN FAZLA veri kaynağı var: veritabanı, ihalebul.com profili, Tavily web araması, derin araştırma, KİK kararları, haberler. Aynı konu hakkında FARKLI kaynaklardan gelen veriyi ÇAPRAZ DOĞRULA ve SENTEZLEYEREk kullan. Tek bir kaynağa bağımlı kalma.
- Bir bilginin HANGİ KAYNAKTAN geldiğini parantez içinde belirt (örn: "(ihalebul.com)" veya "(Tavily web)" veya "(DB)").

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

## RAKİP AĞI VE ORTAK GİRİŞİMLER
- En sık karşılaşılan rakipler, portföy büyüklükleri ve bu firma ile güç karşılaştırması
- Hangi firmalara karşı kazanıyor/kaybediyor (tüm kaynaklardan sentezle)
- İş ortaklığı kurduğu firmalar, ortak girişim sözleşmeleri, hangi ihalelerde birlikte hareket ettiği
- ÖNEMLİ: Aynı firma hem rakip listesinde hem ortak girişim/birlikte hareket listesinde varsa bu "coopetition" kalıbını AYRI olarak analiz et. "Bazen rakip bazen ortak" ilişkisi istihbarat açısından çok kritiktir — hangi koşullarda ortak oluyorlar, hangi koşullarda rakip?

## STRATEJİK TAVSİYELER
(Bu firmayla aynı ihaleye girerken dikkat edilecek 5-7 somut öneri)
`;

  // ── Firma bilgileri (kompakt TSV-benzeri format) ──
  prompt += `\n═══ FİRMA: ${yuklenici.unvan}${yuklenici.kisa_ad ? ` (${yuklenici.kisa_ad})` : ''} ═══
ihale:${yuklenici.katildigi_ihale_sayisi || '?'} | kazanma:%${yuklenici.kazanma_orani || '?'} | sözleşme:${fmt(yuklenici.toplam_sozlesme_bedeli)} | indirim:%${yuklenici.ortalama_indirim_orani || '?'} | son:${yuklenici.son_ihale_tarihi || '?'}
fesih:${yuklenici.fesih_sayisi || 0} | kik_şikayet:${yuklenici.kik_sikayet_sayisi || 0} | risk:${yuklenici.risk_notu || '-'}
şehirler:${(yuklenici.aktif_sehirler || []).join(',')} | etiketler:${(yuklenici.etiketler || []).join(',') || '-'}
`;

  // ── İhale geçmişi (kompakt TSV — aynı veri, %30 daha az token) ──
  if (ihaleler.length > 0) {
    prompt += `\n═══ İHALELER (${ihaleler.length}) ═══\n`;
    // Sadece dolu alanları | ile birleştir — boşlukları atla
    for (const ih of ihaleler) {
      const p = [];
      if (ih.ihale_adi) p.push(ih.ihale_adi);
      if (ih.idare) p.push(ih.idare);
      if (ih.sehir) p.push(ih.ilce ? `${ih.sehir}/${ih.ilce}` : ih.sehir);
      if (ih.durum) p.push(ih.durum);
      if (ih.rol) p.push(ih.rol);
      if (ih.ihale_niteligi) p.push(ih.ihale_niteligi);
      if (ih.indirim_orani) p.push(`i:%${ih.indirim_orani}`);
      if (ih.sozlesme_bedeli) p.push(`b:${fmt(ih.sozlesme_bedeli)}`);
      if (ih.yaklasik_maliyet) p.push(`y:${fmt(ih.yaklasik_maliyet)}`);
      if (ih.toplam_teklif_sayisi) p.push(`t:${ih.toplam_teklif_sayisi}`);
      if (ih.gecerli_teklif_sayisi) p.push(`g:${ih.gecerli_teklif_sayisi}`);
      if (ih.en_yuksek_teklif) p.push(`mx:${fmt(ih.en_yuksek_teklif)}`);
      if (ih.en_dusuk_teklif) p.push(`mn:${fmt(ih.en_dusuk_teklif)}`);
      if (ih.is_suresi) p.push(ih.is_suresi);
      if (ih.fesih_durumu) p.push(`FESİH:${ih.fesih_durumu}`);
      if (ih.kisim_adi) p.push(ih.kisim_adi);
      if (ih.sozlesme_tarihi) p.push(ih.sozlesme_tarihi);
      if (ih.veri_kaynagi) p.push(`[${ih.veri_kaynagi}]`);
      prompt += `${p.join('|')}\n`;
    }
  }

  // ── Rakipler (DB cross-join) ──
  if (rakipler.length > 0) {
    prompt += `\n═══ RAKİP VERİSİ (Veritabanı Cross-Join) ═══\n`;
    for (const r of rakipler) {
      prompt += `• ${r.unvan}: ${r.ortak_ihale_sayisi} ortak ihale\n`;
    }
  }

  // ── KİK kararları (tüm detaylarıyla) ──
  if (kikKararlar.length > 0) {
    prompt += `\n═══ KİK KARARLARI (${kikKararlar.length} adet) ═══\n`;
    for (const k of kikKararlar) {
      const parts = [
        k.ihale_adi || '?',
        k.idare || '',
        k.sehir || '',
        k.durum || '-',
        k.sozlesme_bedeli ? `bedel:${fmt(k.sozlesme_bedeli)}` : '',
        k.sozlesme_tarihi || k.created_at || '',
      ].filter(Boolean);
      prompt += `• ${parts.join(' | ')}\n`;
    }
  }

  // ── Diğer modül verileri ──

  // Haberler (TÜM haberler + içerik varsa ekle)
  if (modulMap.haberler) {
    const haberler = modulMap.haberler;
    if (haberler.haberler && haberler.haberler.length > 0) {
      prompt += `\n═══ BASINDA ÇIKAN HABERLER (${haberler.toplam || haberler.haberler.length} adet) ═══\n`;
      for (const h of haberler.haberler) {
        prompt += `• [${h.tarih_okunur || '?'}] ${h.baslik} (${h.kaynak || '?'})`;
        if (h.kaynak_tipi) prompt += ` [${h.kaynak_tipi}]`;
        if (h.skor) prompt += ` güven:%${(h.skor * 100).toFixed(0)}`;
        prompt += '\n';
        if (h.ozet && h.ozet.length > 50) {
          prompt += `  Özet: ${h.ozet.substring(0, 1000)}\n`;
        }
        if (h.link) prompt += `  URL: ${h.link}\n`;
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
        prompt += `• ${JSON.stringify(s).replace(/"/g, '')}\n`;
      }
    }
  }

  // Şirket bilgileri (TÜM ilanlar — kısıtlama yok)
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
        prompt += `Ticaret Sicil İlanları (${sb.ticaret_sicil.ilanlar.length} adet):\n`;
        for (const ilan of sb.ticaret_sicil.ilanlar) {
          prompt += `  • ${JSON.stringify(ilan).replace(/"/g, '')}\n`;
        }
      }
    }
  }

  // Profil analizi (kompakt JSON — indent yok)
  if (modulMap.profil_analizi) {
    const profil = modulMap.profil_analizi;
    prompt += `\n═══ İHALEBUL.COM PROFİL ANALİZİ ═══\n`;
    prompt += `${JSON.stringify(profil)}\n`;
  }

  // ihalebul.com analiz verisi — YAPILANDIRILMIŞ şekilde sun
  if (yuklenici.analiz_verisi) {
    const av = yuklenici.analiz_verisi;

    // Özet istatistikler (kompakt)
    if (av.ozet) {
      prompt += `\n═══ İHALEBUL.COM İSTATİSTİK ÖZETİ ═══\n`;
      prompt += `${JSON.stringify(av.ozet)}\n`;
    }

    // RAKİPLER — ayrı ve açık bölüm
    if (av.rakipler?.length > 0) {
      prompt += `\n═══ RAKİP ANALİZİ — İHALEBUL.COM VERİSİ (${av.rakipler.length} rakip) ═══\n`;
      prompt += `Bu firmalar Degsan ile aynı ihalelere katılmış firmalardır:\n`;
      for (const r of av.rakipler) {
        const kisa = r.rakip_adi.split(/\s+/).slice(0, 4).join(' ');
        prompt += `• ${kisa}: ${r.ihale_sayisi} ortak ihale, toplam sözleşme: ${fmt(r.toplam_sozlesme)}\n`;
      }
    }

    // ORTAK GİRİŞİMLER — ayrı ve açık bölüm
    if (av.ortak_girisimler?.length > 0) {
      prompt += `\n═══ ORTAK GİRİŞİMLER (İŞ ORTAKLIĞI) — İHALEBUL.COM VERİSİ ═══\n`;
      prompt += `Bu firma şu ortaklarla iş ortaklığı kurarak ihale kazanmış:\n`;
      for (const og of av.ortak_girisimler) {
        const kisa = og.partner_adi.split(/\s+/).slice(0, 4).join(' ');
        prompt += `• Partner: ${kisa}\n`;
        prompt += `  Devam eden: ${og.devam_eden} | Tamamlanan: ${og.tamamlanan} | Toplam sözleşme: ${fmt(og.toplam_sozlesme)}\n`;
      }
    } else {
      prompt += `\n═══ ORTAK GİRİŞİMLER ═══\nOrtak girişim kaydı bulunmuyor.\n`;
    }

    // Yükleniciler listesi (iş ortaklığı dahil tüm taraflar)
    if (av.yukleniciler_listesi?.length > 0) {
      prompt += `\n═══ YÜKLENİCİ TARAFLARI ═══\n`;
      for (const yk of av.yukleniciler_listesi) {
        const kisa = yk.yuklenici_adi.split(/\s+/).slice(0, 4).join(' ');
        prompt += `• ${kisa}: devam=${yk.devam_eden}, tamamlanan=${yk.tamamlanan}, toplam=${fmt(yk.toplam_sozlesme)}\n`;
      }
    }

    // ── ÇAPRAZ KONTROL: Veri havuzundan gelen coopetition ve eşleşme verisi ──
    if (caprazKontrol?.coopetition?.length > 0) {
      prompt += `\n═══ ⚠️ ÇAPRAZ KONTROL: HEM RAKİP HEM ORTAK FİRMALAR ═══\n`;
      prompt += `Aşağıdaki firmalar hem rakip olarak karşılaşılmış hem de iş ortaklığı kurulmuş — bu "coopetition" (bazen rakip, bazen ortak) kalıbıdır. Bu ilişkilerin dinamiğini derinlemesine analiz et:\n`;
      for (const k of caprazKontrol.coopetition) {
        prompt += `• ${k.firma}\n`;
        prompt += `  RAKİP olarak: ${k.rakip_ihale_sayisi} ortak ihale, ${fmt(k.rakip_sozlesme)} portföy\n`;
        prompt += `  ORTAK olarak: devam=${k.ortak_devam_eden || 0}, tamam=${k.ortak_tamamlanan || 0}, ${fmt(k.ortak_sozlesme)} sözleşme\n`;
      }
    } else if (av.rakipler?.length > 0 && av.ortak_girisimler?.length > 0) {
      // Fallback: havuz yoksa eski inline çapraz kontrol
      const kesisim = [];
      for (const r of av.rakipler) {
        const rKisa = r.rakip_adi.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
        for (const o of av.ortak_girisimler) {
          const oKisa = o.partner_adi.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
          if (r.rakip_adi.toLowerCase() === o.partner_adi.toLowerCase() || rKisa === oKisa) {
            kesisim.push({
              firma: r.rakip_adi.split(/\s+/).slice(0, 4).join(' '),
              rakipOlarakIhale: r.ihale_sayisi,
              rakipSozlesme: r.toplam_sozlesme,
              ortakSozlesme: o.toplam_sozlesme,
            });
          }
        }
      }
      if (kesisim.length > 0) {
        prompt += `\n═══ ⚠️ ÇAPRAZ KONTROL: HEM RAKİP HEM ORTAK FİRMALAR ═══\n`;
        for (const k of kesisim) {
          prompt += `• ${k.firma}: RAKİP ${k.rakipOlarakIhale} ihale ${fmt(k.rakipSozlesme)} | ORTAK ${fmt(k.ortakSozlesme)}\n`;
        }
      }
    }

    if (caprazKontrol?.rakip_ihale_eslesmeler?.length > 0) {
      prompt += `\n═══ RAKİP İSİMLERİNİN İHALE METİNLERİNDE GEÇTİĞİ YERLER ═══\n`;
      for (const re of caprazKontrol.rakip_ihale_eslesmeler) {
        prompt += `• ${re.rakip} → ${re.ihaleler.join('; ')}\n`;
      }
    }

    // İdareler
    if (av.idareler?.length > 0) {
      prompt += `\n═══ EN ÇOK ÇALIŞILAN İDARELER (${av.idareler.length} idare) ═══\n`;
      for (const idare of av.idareler) {
        prompt += `• ${idare.idare_adi || idare.ad}: ${idare.ihale_sayisi || idare.sayi || '?'} ihale, ${fmt(idare.toplam_sozlesme || idare.tutar)}\n`;
      }
    }

    // Şehirler
    if (av.sehirler?.length > 0) {
      prompt += `\n═══ ŞEHİR BAZLI DAĞILIM (${av.sehirler.length} şehir) ═══\n`;
      for (const s of av.sehirler) {
        prompt += `• ${s.sehir || s.ad}: ${s.ihale_sayisi || s.sayi || '?'} ihale, ${fmt(s.toplam_sozlesme || s.tutar)}\n`;
      }
    }

    // Sektörler
    if (av.sektorler?.length > 0) {
      prompt += `\n═══ SEKTÖR DAĞILIMI ═══\n`;
      for (const sk of av.sektorler) {
        prompt += `• ${sk.sektor_adi || sk.ad}: ${sk.ihale_sayisi || sk.sayi || '?'} ihale, ${fmt(sk.toplam_sozlesme || sk.tutar)}\n`;
      }
    }

    // Yıllık trend
    if (av.yillik_trend?.length > 0) {
      prompt += `\n═══ YILLIK İHALE TRENDİ ═══\n`;
      for (const yt of av.yillik_trend) {
        prompt += `• ${yt.yil}: ${yt.ihale_sayisi || yt.sayi || '?'} ihale, ${fmt(yt.toplam_sozlesme || yt.tutar)}\n`;
      }
    }

    // İhale türleri
    if (av.ihale_turleri?.length > 0) {
      prompt += `\n═══ İHALE TÜRLERİ ═══\n`;
      for (const it of av.ihale_turleri) {
        prompt += `• ${it.ad || it.tur}: ${it.gecmis || it.sayi || '?'} geçmiş, ${it.guncel || 0} güncel, ${fmt(it.toplam_sozlesme)}\n`;
      }
    }

    // İhale usulleri
    if (av.ihale_usulleri?.length > 0) {
      prompt += `\n═══ İHALE USULLERİ ═══\n`;
      for (const iu of av.ihale_usulleri) {
        prompt += `• ${iu.ad || iu.usul}: ${iu.gecmis || iu.sayi || '?'} geçmiş, ${fmt(iu.toplam_sozlesme)}\n`;
      }
    }

    // Teklif türleri
    if (av.teklif_turleri?.length > 0) {
      prompt += `\n═══ TEKLİF TÜRLERİ ═══\n`;
      for (const tt of av.teklif_turleri) {
        prompt += `• ${tt.ad || tt.tur}: ${tt.gecmis || tt.sayi || '?'} geçmiş, ${fmt(tt.toplam_sozlesme)}\n`;
      }
    }
  }

  // ── Web istihbaratı (kompakt — URL yerine domain, gereksiz boşluklar yok) ──
  if (webIstihbarat) {
    const getDomain = (url) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } };

    if (webIstihbarat.aiOzet) {
      prompt += `\n═══ WEB ÖZETİ (Tavily AI) ═══\n${webIstihbarat.aiOzet}\n`;
    }

    // Tüm web sonuçlarını tek blokta göster (daha az section header)
    const allWebResults = [
      ...(webIstihbarat.webSonuclari || []).map(r => ({ ...r, tip: 'ihale' })),
      ...(webIstihbarat.kikKararMetinleri || []).map(r => ({ ...r, tip: 'kik' })),
      ...(webIstihbarat.haberSonuclari || []).map(r => ({ ...r, tip: 'haber' })),
      ...(webIstihbarat.sicilSonuclari || []).map(r => ({ ...r, tip: 'sicil' })),
    ];

    if (allWebResults.length > 0) {
      prompt += `\n═══ WEB SONUÇLARI (${allWebResults.length}) ═══\n`;
      if (webIstihbarat.haberOzet) prompt += `Haber özeti: ${webIstihbarat.haberOzet}\n`;
      for (const r of allWebResults) {
        prompt += `[${r.tip}] ${r.title || '-'} (${getDomain(r.url)})`;
        if (r.content) prompt += ` — ${r.content}`;
        prompt += '\n';
      }
    }

    // Tam metinler — bunlar büyük, ama veri kaybetmemeliyiz
    if (webIstihbarat.tamMetinler?.length > 0) {
      prompt += `\n═══ TAM METİNLER (${webIstihbarat.tamMetinler.length}) ═══\n`;
      for (const t of webIstihbarat.tamMetinler) {
        prompt += `--- ${getDomain(t.url)} ---\n${t.metin}\n`;
      }
    }
  }

  // ── Derin Analiz (kompakt — URL yerine domain) ──
  if (modulMap.derin_analiz) {
    const da = modulMap.derin_analiz;
    const getDomain2 = (url) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; } };
    prompt += `\n═══ DERİN ARAŞTIRMA (${da.kaynak_sayisi || '?'} kaynak) ═══\n`;
    if (da.ozet) prompt += `${da.ozet}\n`;
    if (da.kaynaklar?.length > 0) {
      for (const k of da.kaynaklar) {
        prompt += `[${getDomain2(k.url)}] ${k.title || '-'}`;
        if (k.score) prompt += ` g:%${(k.score * 100).toFixed(0)}`;
        if (k.excerpt) prompt += ` — ${k.excerpt}`;
        prompt += '\n';
      }
    }
    if (da.alt_sorgular?.length > 0) prompt += `stratejiler: ${da.alt_sorgular.join('|')}\n`;
  }

  // ── Haber tam içerikleri ──
  if (modulMap.haberler?.haberler) {
    const derinIcerikli = modulMap.haberler.haberler.filter((h) => h.tam_icerik);
    if (derinIcerikli.length > 0) {
      prompt += `\n═══ HABER TAM İÇERİKLERİ (${derinIcerikli.length}) ═══\n`;
      for (const h of derinIcerikli) {
        prompt += `--- ${h.baslik || '-'} (${h.kaynak || '?'}) ---\n${h.tam_icerik}\n`;
      }
    }
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
