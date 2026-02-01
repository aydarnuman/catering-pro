/**
 * AI Akıllı Ürün Eşleştirme Servisi
 *
 * Fatura kalemlerini ürün kartlarına akıllıca eşleştirir.
 * - Marka, gramaj, birim bilgilerini analiz eder
 * - Birim çarpanı hesaplar (5 KG = 5)
 * - Mapping tablosuna kaydeder
 */

import Anthropic from '@anthropic-ai/sdk';
import { query } from '../database.js';
import logger from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Tüm aktif ürün kartlarını getir
 */
async function getUrunKartlari() {
  const result = await query(`
    SELECT 
      uk.id, 
      uk.kod, 
      uk.ad,
      uk.varsayilan_birim,
      kat.ad as kategori_ad
    FROM urun_kartlari uk
    LEFT JOIN urun_kategorileri kat ON kat.id = uk.kategori_id
    WHERE uk.aktif = true
    ORDER BY uk.ad
  `);
  return result.rows;
}

/**
 * AI ile tek bir fatura kalemini eşleştir
 */
export async function aiEslestirTekKalem(faturaKalemi, urunKartlari) {
  const prompt = `Sen bir yemek/gıda sektörü uzmanısın. Aşağıdaki fatura kalemini, verilen ürün kartları listesinden en uygun olanıyla eşleştir.

FATURA KALEMİ:
- Ürün Adı: "${faturaKalemi.orijinal_urun_adi}"
- Birim: ${faturaKalemi.birim || 'belirtilmemiş'}
- Birim Fiyat: ${faturaKalemi.birim_fiyat} TL

ÜRÜN KARTLARI LİSTESİ:
${urunKartlari.map((u) => `- ID: ${u.id}, Ad: "${u.ad}", Kategori: ${u.kategori_ad || 'Genel'}, Birim: ${u.varsayilan_birim || 'kg'}`).join('\n')}

KURALLAR:
1. Fatura kalemindeki MARKA ismini (BESLER, DOĞUŞ, NATUREM vb.) GÖRMEZDEN GEL
2. Ürünün ÖZÜNÜ bul (şeker, çay, reçel, meyve suyu vb.)
3. Birim çarpanı hesapla:
   - "5 KG" yazıyorsa birim_carpan = 5
   - "500 GR" yazıyorsa birim_carpan = 0.5
   - "1 LT" yazıyorsa birim_carpan = 1
   - "250 ML" yazıyorsa birim_carpan = 0.25
   - Paket/koli ise içindeki miktarı hesapla (örn: "25*40 GR" = 1 kg = 1)
4. Eğer hiçbir ürün kartı uygun değilse, null döndür

JSON formatında yanıt ver:
{
  "urun_kart_id": <number veya null>,
  "urun_kart_adi": "<string>",
  "birim_carpan": <number>,
  "standart_birim": "<kg, lt, adet>",
  "aciklama": "<neden bu eşleşmeyi seçtin>",
  "guven_skoru": <0-100>
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].text;

    // JSON parse
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('AI eşleştirme JSON parse hatası', { content });
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);
    return result;
  } catch (error) {
    logger.error('AI eşleştirme hatası', { error: error.message });
    return null;
  }
}

/**
 * Toplu AI eşleştirme
 */
export async function aiTopluEslestir(limit = 20) {
  const sonuclar = { basarili: 0, hatali: 0, detaylar: [] };

  try {
    // Ürün kartlarını al
    const urunKartlari = await getUrunKartlari();

    if (urunKartlari.length === 0) {
      return { success: false, error: 'Ürün kartı bulunamadı' };
    }

    // Eşleşmemiş fatura kalemlerini al
    const kalemlerResult = await query(
      `
      SELECT 
        fk.id,
        fk.fatura_ettn,
        fk.kalem_sira,
        fk.orijinal_urun_adi,
        fk.birim,
        fk.birim_fiyat,
        fk.miktar,
        fk.tedarikci_vkn,
        fk.tedarikci_ad
      FROM fatura_kalemleri fk
      WHERE fk.urun_id IS NULL
        AND fk.orijinal_urun_adi IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM tedarikci_urun_mapping tum 
          WHERE tum.fatura_urun_adi = fk.orijinal_urun_adi
        )
      ORDER BY fk.created_at DESC
      LIMIT $1
    `,
      [limit]
    );

    const kalemler = kalemlerResult.rows;

    if (kalemler.length === 0) {
      return { success: true, message: 'Eşleştirilecek kalem bulunamadı', data: sonuclar };
    }

    logger.info('AI toplu eşleştirme başlatıldı', { kalemSayisi: kalemler.length });

    // Her kalem için AI eşleştirme yap
    for (const kalem of kalemler) {
      try {
        const aiSonuc = await aiEslestirTekKalem(kalem, urunKartlari);

        if (aiSonuc?.urun_kart_id && aiSonuc.guven_skoru >= 60) {
          // Mapping tablosuna kaydet
          await query(
            `
            INSERT INTO tedarikci_urun_mapping (
              tedarikci_vkn, tedarikci_ad, fatura_urun_adi, fatura_urun_kodu,
              urun_kart_id, birim_carpani, standart_birim,
              eslestirme_sayisi, aktif
            ) VALUES ($1, $2, $3, $3, $4, $5, $6, 1, true)
            ON CONFLICT (tedarikci_vkn, fatura_urun_kodu) 
            DO UPDATE SET 
              urun_kart_id = EXCLUDED.urun_kart_id,
              birim_carpani = EXCLUDED.birim_carpani,
              fatura_urun_adi = EXCLUDED.fatura_urun_adi,
              updated_at = NOW()
          `,
            [
              kalem.tedarikci_vkn || 'GENEL',
              kalem.tedarikci_ad || 'Bilinmeyen',
              kalem.orijinal_urun_adi,
              aiSonuc.urun_kart_id,
              aiSonuc.birim_carpan || 1,
              aiSonuc.standart_birim || 'kg',
            ]
          );

          // Fatura kalemini güncelle
          await query(
            `
            UPDATE fatura_kalemleri 
            SET urun_id = $1, eslestirme_tarihi = NOW()
            WHERE id = $2
          `,
            [aiSonuc.urun_kart_id, kalem.id]
          );

          // Fiyat geçmişine ekle
          const kaynakResult = await query("SELECT id FROM fiyat_kaynaklari WHERE kod = 'FATURA'");
          const kaynakId = kaynakResult.rows[0]?.id;

          if (kaynakId && kalem.birim_fiyat > 0) {
            // Standart birim fiyatı hesapla
            const standartFiyat = kalem.birim_fiyat / (aiSonuc.birim_carpan || 1);

            await query(
              `
              INSERT INTO urun_fiyat_gecmisi (
                urun_kart_id, fiyat, kaynak_id, kaynak, tarih, 
                fatura_ettn, aciklama
              ) VALUES ($1, $2, $3, 'AI Eşleştirme', CURRENT_DATE, $4, $5)
              ON CONFLICT DO NOTHING
            `,
              [
                aiSonuc.urun_kart_id,
                standartFiyat,
                kaynakId,
                kalem.fatura_ettn,
                `${kalem.tedarikci_ad}: ${kalem.orijinal_urun_adi} (Çarpan: ${aiSonuc.birim_carpan})`,
              ]
            );
          }

          sonuclar.basarili++;
          sonuclar.detaylar.push({
            fatura_urun: kalem.orijinal_urun_adi,
            eslesme: aiSonuc.urun_kart_adi,
            birim_carpan: aiSonuc.birim_carpan,
            guven: aiSonuc.guven_skoru,
            aciklama: aiSonuc.aciklama,
          });

          logger.info('AI eşleştirme başarılı', {
            faturaUrun: kalem.orijinal_urun_adi,
            eslesme: aiSonuc.urun_kart_adi,
            guven: aiSonuc.guven_skoru,
          });
        } else {
          sonuclar.hatali++;
          sonuclar.detaylar.push({
            fatura_urun: kalem.orijinal_urun_adi,
            eslesme: null,
            hata: aiSonuc ? `Düşük güven: ${aiSonuc.guven_skoru}` : 'AI yanıt vermedi',
          });
        }

        // Rate limiting - 1 saniye bekle
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (kalemError) {
        sonuclar.hatali++;
        sonuclar.detaylar.push({
          fatura_urun: kalem.orijinal_urun_adi,
          hata: kalemError.message,
        });
      }
    }

    return {
      success: true,
      data: sonuclar,
      message: `${sonuclar.basarili}/${kalemler.length} kalem eşleştirildi`,
    };
  } catch (error) {
    logger.error('AI toplu eşleştirme hatası', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Mevcut mapping'leri kullanarak fatura kalemlerini eşleştir
 */
export async function mappingIleEslestir() {
  try {
    const result = await query(`
      UPDATE fatura_kalemleri fk
      SET 
        urun_id = tum.urun_kart_id,
        eslestirme_tarihi = NOW()
      FROM tedarikci_urun_mapping tum
      WHERE fk.urun_id IS NULL
        AND tum.aktif = true
        AND (
          (tum.tedarikci_vkn = fk.tedarikci_vkn AND tum.fatura_urun_adi = fk.orijinal_urun_adi)
          OR (tum.tedarikci_vkn = 'GENEL' AND tum.fatura_urun_adi = fk.orijinal_urun_adi)
        )
      RETURNING fk.id, fk.orijinal_urun_adi, tum.urun_kart_id
    `);

    return {
      success: true,
      eslesen: result.rowCount,
      detaylar: result.rows,
    };
  } catch (error) {
    logger.error('Mapping eşleştirme hatası', { error: error.message });
    return { success: false, error: error.message };
  }
}

export default {
  aiEslestirTekKalem,
  aiTopluEslestir,
  mappingIleEslestir,
};
