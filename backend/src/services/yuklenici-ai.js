/**
 * Yüklenici AI Service
 *
 * Claude AI ile yüklenici profil özeti, strateji tahmini ve rakip analizi
 * contractors.js route'unda kullanılır
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';

class YukleniciAIService {
  constructor() {
    this.client = null;
    this.model = 'claude-opus-4-6';
  }

  getClient() {
    if (!this.client) {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY tanımlı değil');
      }
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  /**
   * Yüklenici profil özeti oluştur
   * "Bu firma hakkında ne biliyoruz?" sorusuna AI yanıtı
   *
   * @param {number} yukleniciId
   * @returns {Object} { success, ozet, analiz }
   */
  async generateProfilOzeti(yukleniciId) {
    try {
      // Yüklenici bilgileri
      const ykResult = await query('SELECT * FROM yukleniciler WHERE id = $1', [yukleniciId]);
      if (ykResult.rows.length === 0) {
        return { success: false, error: 'Yüklenici bulunamadı' };
      }
      const yk = ykResult.rows[0];

      // İhale geçmişi
      const ihaleler = await query(
        `SELECT ihale_basligi, kurum_adi, sehir, sozlesme_bedeli, sozlesme_tarihi, 
                indirim_orani, durum, fesih_durumu, rol
         FROM yuklenici_ihaleleri
         WHERE yuklenici_id = $1
         ORDER BY sozlesme_tarihi DESC NULLS LAST
         LIMIT 30`,
        [yukleniciId]
      );

      // Analiz verisi (varsa)
      const analizData = yk.analiz_verisi ? JSON.stringify(yk.analiz_verisi, null, 0) : 'Yok';

      const prompt = `Sen bir ihale istihbarat analistisin. Aşağıdaki verilere dayanarak bu yüklenici firma hakkında kapsamlı bir profil özeti hazırla.

## FİRMA BİLGİLERİ
- Ünvan: ${yk.unvan}
- Kısa Ad: ${yk.kisa_ad || 'Yok'}
- Katıldığı İhale Sayısı: ${yk.katildigi_ihale_sayisi}
- Tamamlanan İş: ${yk.tamamlanan_is_sayisi}
- Devam Eden İş: ${yk.devam_eden_is_sayisi}
- Kazanma Oranı: %${yk.kazanma_orani}
- Toplam Sözleşme Bedeli: ${yk.toplam_sozlesme_bedeli ? `₺${Number(yk.toplam_sozlesme_bedeli).toLocaleString('tr-TR')}` : 'Bilinmiyor'}
- Ortalama İndirim Oranı: ${yk.ortalama_indirim_orani ? `%${yk.ortalama_indirim_orani}` : 'Bilinmiyor'}
- Aktif Şehirler: ${JSON.stringify(yk.aktif_sehirler)}
- Fesih Sayısı: ${yk.fesih_sayisi || 0}
- KİK Şikayet: ${yk.kik_sikayet_sayisi || 0}

## İHALE GEÇMİŞİ (Son 30 ihale)
${ihaleler.rows.map((i) => `- ${i.ihale_basligi || 'N/A'} | ${i.sehir || 'N/A'} | ${i.sozlesme_bedeli ? `₺${Number(i.sozlesme_bedeli).toLocaleString('tr-TR')}` : 'N/A'} | ${i.durum} | İndirim: ${i.indirim_orani || 'N/A'}%`).join('\n')}

## ANALİZ VERİSİ (ihalebul.com)
${analizData.substring(0, 3000)}

---

Aşağıdaki başlıklarda Türkçe özet hazırla:
1. **Firma Profili**: Kim bu firma? Ne büyüklükte? Hangi bölgelerde aktif?
2. **Güçlü Yönleri**: Nerelerde başarılı? Hangi ihale türlerinde güçlü?
3. **Zayıf Yönleri**: Fesih var mı? Hangi alanlarda zayıf?
4. **Fiyatlama Stratejisi**: İndirim oranı trendleri, agresif mi muhafazakâr mı?
5. **Risk Değerlendirmesi**: Bu firmayla rekabet ederken dikkat edilmesi gerekenler
6. **Sonuç**: 1-2 cümlelik genel değerlendirme

Kısa, öz ve aksiyon odaklı yaz. Maksimum 500 kelime.`;

      const response = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      });

      const ozet = response.content[0]?.text || '';

      return {
        success: true,
        ozet,
        meta: {
          model: this.model,
          created_at: new Date().toISOString(),
          data_points: {
            ihale_sayisi: ihaleler.rows.length,
            has_analiz: !!yk.analiz_verisi,
          },
        },
      };
    } catch (error) {
      logger.error('Yüklenici AI Profil Özeti', { error: error.message, yukleniciId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Bir ihale için rakip risk analizi
   * "Bu ihalede hangi rakipler güçlü?" sorusuna AI yanıtı
   *
   * @param {number} tenderId
   * @returns {Object} { success, analiz }
   */
  async generateRakipAnalizi(tenderId) {
    try {
      // İhale bilgileri
      const tenderResult = await query(
        'SELECT id, title, city, estimated_cost, organization_name FROM tenders WHERE id = $1',
        [tenderId]
      );
      if (tenderResult.rows.length === 0) {
        return { success: false, error: 'İhale bulunamadı' };
      }
      const tender = tenderResult.rows[0];

      // Bu ihalenin katılımcıları
      const katilimcilar = await query(
        `SELECT y.unvan, y.toplam_sozlesme_bedeli, y.kazanma_orani, y.ortalama_indirim_orani,
                y.katildigi_ihale_sayisi, y.fesih_sayisi, yi.rol
         FROM yuklenici_ihaleleri yi
         JOIN yukleniciler y ON yi.yuklenici_id = y.id
         WHERE yi.tender_id = $1`,
        [tenderId]
      );

      // Aynı şehirdeki güçlü rakipler
      const bolgeRakipleri = await query(
        `SELECT y.unvan, y.toplam_sozlesme_bedeli, y.kazanma_orani, y.ortalama_indirim_orani,
                COUNT(t.id) as bolge_ihale_sayisi
         FROM yukleniciler y
         JOIN tenders t ON t.yuklenici_id = y.id
         WHERE t.city = $1
         GROUP BY y.id
         ORDER BY bolge_ihale_sayisi DESC
         LIMIT 10`,
        [tender.city]
      );

      const prompt = `Sen bir ihale stratejisti olarak, aşağıdaki ihale için rakip analizi yap.

## İHALE BİLGİLERİ
- Başlık: ${tender.title}
- Şehir: ${tender.city}
- Yaklaşık Maliyet: ${tender.estimated_cost ? `₺${Number(tender.estimated_cost).toLocaleString('tr-TR')}` : 'Belirtilmemiş'}
- Kurum: ${tender.organization_name}

## KATILIMCILAR (${katilimcilar.rows.length} firma)
${katilimcilar.rows.map((k) => `- ${k.unvan} | Kazanma: %${k.kazanma_orani} | İndirim: %${k.ortalama_indirim_orani || '?'} | Toplam: ₺${Number(k.toplam_sozlesme_bedeli || 0).toLocaleString('tr-TR')} | Rol: ${k.rol}`).join('\n') || 'Henüz katılımcı bilgisi yok'}

## BÖLGE RAKİPLERİ (${tender.city})
${bolgeRakipleri.rows.map((r) => `- ${r.unvan} | ${r.bolge_ihale_sayisi} bölge ihalesi | Kazanma: %${r.kazanma_orani}`).join('\n') || 'Bölge rakibi bilgisi yok'}

---

Şu başlıklarda analiz yap:
1. **Tehdit Seviyesi**: Bu ihalede rekabet ne kadar güçlü? (Düşük/Orta/Yüksek)
2. **En Güçlü Rakipler**: Hangi firmalar öne çıkıyor ve neden?
3. **Fiyat Tahmini**: Rakiplerin muhtemel indirim aralığı
4. **Strateji Önerisi**: Bu ihalede nasıl bir yaklaşım izlenmeli?
5. **Fırsat/Risk**: Dikkat edilmesi gereken noktalar

Kısa ve aksiyon odaklı yaz. Maksimum 300 kelime.`;

      const response = await this.getClient().messages.create({
        model: this.model,
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      return {
        success: true,
        analiz: response.content[0]?.text || '',
        meta: {
          model: this.model,
          created_at: new Date().toISOString(),
          tender_id: tenderId,
          katilimci_sayisi: katilimcilar.rows.length,
          bolge_rakip_sayisi: bolgeRakipleri.rows.length,
        },
      };
    } catch (error) {
      logger.error('Yüklenici AI Rakip Analizi', { error: error.message, tenderId });
      return { success: false, error: error.message };
    }
  }
}

export default new YukleniciAIService();
