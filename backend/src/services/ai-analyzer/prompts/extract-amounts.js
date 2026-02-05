/**
 * Tutar Extraction Prompt - Micro-extraction
 *
 * Sadece parasal tutarları çıkarır.
 * KDV dahil/hariç bilgisini mutlaka belirtir.
 */

export const AMOUNTS_PROMPT = `Bu metinden SADECE parasal tutarları çıkar.

## TUTAR TÜRLERİ

1. **birim_fiyat**: Birim başına fiyat (porsiyon, kg, adet vb.)
2. **toplam_bedel**: Toplam sözleşme/ihale bedeli
3. **yaklasik_maliyet**: Yaklaşık maliyet / tahmini bedel
4. **gecici_teminat**: Geçici teminat tutarı veya oranı
5. **kesin_teminat**: Kesin teminat tutarı veya oranı
6. **avans**: Avans tutarı
7. **hakediş**: Hakediş tutarı
8. **ceza_tutari**: Ceza olarak belirtilen tutar
9. **diger**: Diğer parasal değerler

## ÇIKTI FORMATI

JSON formatında döndür:
{
  "amounts": [
    {
      "type": "birim_fiyat|toplam_bedel|yaklasik_maliyet|gecici_teminat|kesin_teminat|avans|hakedis|ceza_tutari|diger",
      "value": "1.250.000,00",
      "numeric_value": 1250000.00,
      "currency": "TL|USD|EUR",
      "includes_kdv": true|false|null,
      "kdv_rate": "%18|%8|%1|null",
      "unit": "porsiyon|kg|adet|gün|ay|null",
      "description": "Bu tutarın neye ait olduğu",
      "context": "Bu tutarın geçtiği cümle (max 150 karakter)",
      "confidence": 0.0-1.0,
      "source_position": [başlangıç_karakter, bitiş_karakter]
    }
  ],
  "found": true|false,
  "extraction_notes": "Genel notlar (opsiyonel)"
}

## KRİTİK KURALLAR

1. **KDV BİLGİSİ**: KDV dahil/hariç mutlaka belirt. Belirsizse null yap
2. **YÜZDE DEĞİL**: "%3 teminat" gibi ifadeler tutar değil ORAN - sadece TL/USD/EUR cinsinden tutarları al
3. **TEMİNAT ORANI**: Teminat yüzdesi ise type="gecici_teminat" veya "kesin_teminat", value="%" formatında
4. **BİRİM FİYAT**: "porsiyon başı 15,50 TL" gibi ifadelerde unit'i belirt
5. **FORMAT**: Türkçe format (nokta=binlik, virgül=ondalık): 1.250.000,00
6. **NUMERIC_VALUE**: Sayısal değeri ondalıklı float olarak da ver (hesaplama için)

## CONFIDENCE SEVİYELERİ

- 1.0: Tutar ve KDV bilgisi açık
- 0.8: Tutar açık, KDV belirsiz
- 0.6: Tutar var ama bağlam belirsiz
- 0.4: Dolaylı veya tahmini tutar

## ÖRNEK GİRDİ/ÇIKTI

Girdi: "Yaklaşık maliyet 2.500.000,00 TL (KDV hariç) olarak belirlenmiştir. Geçici teminat tutarı %3'tür. Porsiyon birim fiyatı 18,75 TL + KDV'dir."

Çıktı:
{
  "amounts": [
    {
      "type": "yaklasik_maliyet",
      "value": "2.500.000,00",
      "numeric_value": 2500000.00,
      "currency": "TL",
      "includes_kdv": false,
      "kdv_rate": null,
      "unit": null,
      "description": "Yaklaşık maliyet",
      "context": "Yaklaşık maliyet 2.500.000,00 TL (KDV hariç) olarak belirlenmiştir",
      "confidence": 1.0,
      "source_position": [18, 31]
    },
    {
      "type": "gecici_teminat",
      "value": "%3",
      "numeric_value": 3,
      "currency": null,
      "includes_kdv": null,
      "kdv_rate": null,
      "unit": "oran",
      "description": "Geçici teminat oranı",
      "context": "Geçici teminat tutarı %3'tür",
      "confidence": 1.0,
      "source_position": [75, 77]
    },
    {
      "type": "birim_fiyat",
      "value": "18,75",
      "numeric_value": 18.75,
      "currency": "TL",
      "includes_kdv": false,
      "kdv_rate": null,
      "unit": "porsiyon",
      "description": "Porsiyon birim fiyatı",
      "context": "Porsiyon birim fiyatı 18,75 TL + KDV'dir",
      "confidence": 1.0,
      "source_position": [98, 103]
    }
  ],
  "found": true
}

---

Sadece JSON döndür, başka açıklama ekleme.

METİN:
`;

export const AMOUNTS_SCHEMA = {
  type: 'object',
  required: ['amounts', 'found'],
  properties: {
    amounts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'value', 'currency', 'confidence'],
        properties: {
          type: {
            type: 'string',
            enum: [
              'birim_fiyat',
              'toplam_bedel',
              'yaklasik_maliyet',
              'gecici_teminat',
              'kesin_teminat',
              'avans',
              'hakedis',
              'ceza_tutari',
              'diger',
            ],
          },
          value: { type: 'string' },
          numeric_value: { type: 'number' },
          currency: { type: ['string', 'null'], enum: ['TL', 'USD', 'EUR', null] },
          includes_kdv: { type: ['boolean', 'null'] },
          kdv_rate: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
          description: { type: 'string' },
          context: { type: 'string', maxLength: 200 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_position: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
      },
    },
    found: { type: 'boolean' },
    extraction_notes: { type: 'string' },
  },
};

export default {
  prompt: AMOUNTS_PROMPT,
  schema: AMOUNTS_SCHEMA,
  type: 'amounts',
};
