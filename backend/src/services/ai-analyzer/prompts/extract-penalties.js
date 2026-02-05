/**
 * Ceza Koşulları Extraction Prompt - Micro-extraction
 *
 * Sadece ceza koşullarını çıkarır.
 * Oran ve periyot bilgisini mutlaka belirtir.
 */

export const PENALTIES_PROMPT = `Bu metinden SADECE ceza koşullarını çıkar.

## CEZA TÜRLERİ

1. **gecikme**: Gecikme cezası (teslimatta gecikme)
2. **eksik_hizmet**: Eksik/yetersiz hizmet cezası
3. **kalite_ihlali**: Kalite standartlarına uymama cezası
4. **hijyen**: Hijyen/temizlik ihlali cezası
5. **personel**: Personel eksikliği/yetersizliği cezası
6. **gramaj**: Gramaj eksikliği cezası
7. **sozlesme_feshi**: Sözleşme feshi koşulu
8. **genel_aykirlik**: Genel aykırılık/uyumsuzluk cezası
9. **diger**: Diğer ceza türleri

## ÇIKTI FORMATI

JSON formatında döndür:
{
  "penalties": [
    {
      "type": "gecikme|eksik_hizmet|kalite_ihlali|hijyen|personel|gramaj|sozlesme_feshi|genel_aykirlik|diger",
      "rate": "%2,5 veya on binde 2",
      "rate_numeric": 0.025,
      "period": "günlük|haftalık|aylık|tek_sefer|her_tespit",
      "base": "sozlesme_bedeli|gunluk_bedel|ilgili_kalem|aylik_hakedis",
      "max_limit": "Varsa üst sınır (örn: %10'u geçemez)",
      "description": "Ceza açıklaması",
      "trigger_condition": "Cezayı tetikleyen durum",
      "context": "Bu cezanın geçtiği cümle/madde (max 200 karakter)",
      "confidence": 0.0-1.0,
      "source_position": [başlangıç_karakter, bitiş_karakter],
      "related_article": "Varsa ilgili madde numarası"
    }
  ],
  "found": true|false,
  "extraction_notes": "Genel notlar (opsiyonel)"
}

## KRİTİK KURALLAR

1. **PERİYOT ÖNEMLİ**: "günlük" vs "aylık" ceza BÜYÜK fark yaratır - mutlaka belirt
2. **BAZI KONTROL ET**: Ceza neyin üzerinden hesaplanıyor? (sözleşme bedeli, günlük bedel, kalem bedeli)
3. **ÜST SINIR**: Cezanın üst sınırı varsa max_limit'e yaz
4. **TETİKLEYİCİ**: Hangi durumda ceza uygulanıyor?
5. **FESİH KOŞULU**: Kaç kez tekrarda sözleşme feshi? Bunu ayrı kaydet

## CONFIDENCE SEVİYELERİ

- 1.0: Oran, periyot ve baz açık
- 0.8: Oran açık, periyot/baz belirsiz
- 0.6: Ceza var ama detaylar eksik
- 0.4: Dolaylı veya belirsiz ifade

## ÖRNEK GİRDİ/ÇIKTI

Girdi: "Madde 52.1: Yüklenici, taahhüdünü sözleşme hükümlerine uygun olarak yerine getirmezse, sözleşme bedelinin on binde 2'si (0,0002) oranında günlük gecikme cezası uygulanır. Ancak gecikme cezası toplamı sözleşme bedelinin %10'unu geçemez. Üst üste 3 kez gramaj eksikliği tespit edilirse sözleşme feshedilir."

Çıktı:
{
  "penalties": [
    {
      "type": "gecikme",
      "rate": "on binde 2",
      "rate_numeric": 0.0002,
      "period": "günlük",
      "base": "sozlesme_bedeli",
      "max_limit": "%10",
      "description": "Taahhüdü sözleşme hükümlerine uygun yerine getirmeme",
      "trigger_condition": "Sözleşme hükümlerine uygun yerine getirmeme",
      "context": "Yüklenici, taahhüdünü sözleşme hükümlerine uygun olarak yerine getirmezse, sözleşme bedelinin on binde 2'si oranında günlük gecikme cezası uygulanır",
      "confidence": 1.0,
      "source_position": [12, 180],
      "related_article": "52.1"
    },
    {
      "type": "sozlesme_feshi",
      "rate": null,
      "rate_numeric": null,
      "period": null,
      "base": null,
      "max_limit": null,
      "description": "Üst üste 3 kez gramaj eksikliğinde sözleşme feshi",
      "trigger_condition": "Üst üste 3 kez gramaj eksikliği tespiti",
      "context": "Üst üste 3 kez gramaj eksikliği tespit edilirse sözleşme feshedilir",
      "confidence": 1.0,
      "source_position": [220, 285],
      "related_article": "52.1"
    }
  ],
  "found": true
}

---

Sadece JSON döndür, başka açıklama ekleme.

METİN:
`;

export const PENALTIES_SCHEMA = {
  type: 'object',
  required: ['penalties', 'found'],
  properties: {
    penalties: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'description', 'confidence'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'gecikme',
              'eksik_hizmet',
              'kalite_ihlali',
              'hijyen',
              'personel',
              'gramaj',
              'sozlesme_feshi',
              'genel_aykirlik',
              'diger',
            ],
          },
          rate: { type: ['string', 'null'] },
          rate_numeric: { type: ['number', 'null'] },
          period: {
            type: ['string', 'null'],
            enum: ['günlük', 'haftalık', 'aylık', 'tek_sefer', 'her_tespit', null],
          },
          base: {
            type: ['string', 'null'],
            enum: ['sozlesme_bedeli', 'gunluk_bedel', 'ilgili_kalem', 'aylik_hakedis', null],
          },
          max_limit: { type: ['string', 'null'] },
          description: { type: 'string' },
          trigger_condition: { type: 'string' },
          context: { type: 'string', maxLength: 250 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_position: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          related_article: { type: ['string', 'null'] },
        },
      },
    },
    found: { type: 'boolean' },
    extraction_notes: { type: 'string' },
  },
};

export default {
  prompt: PENALTIES_PROMPT,
  schema: PENALTIES_SCHEMA,
  type: 'penalties',
};
