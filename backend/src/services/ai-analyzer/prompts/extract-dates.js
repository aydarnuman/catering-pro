/**
 * Tarih Extraction Prompt - Micro-extraction
 *
 * Sadece tarih bilgilerini çıkarır.
 * Tahmin YAPMAZ, sadece metinde açıkça yazan tarihleri alır.
 */

export const DATES_PROMPT = `Bu metinden SADECE tarih bilgilerini çıkar.

## TARİH TÜRLERİ

1. **ihale_tarihi**: İhalenin yapılacağı tarih
2. **baslangic**: Sözleşme/hizmet başlangıç tarihi
3. **bitis**: Sözleşme/hizmet bitiş tarihi
4. **teslim**: Teslim tarihi veya süresi
5. **son_basvuru**: Son başvuru/teklif verme tarihi
6. **sozlesme**: Sözleşme imza tarihi
7. **ilan**: İlan tarihi
8. **diger**: Diğer önemli tarihler

## ÇIKTI FORMATI

JSON formatında döndür:
{
  "dates": [
    {
      "type": "ihale_tarihi|baslangic|bitis|teslim|son_basvuru|sozlesme|ilan|diger",
      "value": "DD.MM.YYYY veya tarih aralığı",
      "raw_text": "Metinde aynen geçen tarih ifadesi",
      "context": "Bu tarihin geçtiği cümle (max 150 karakter)",
      "confidence": 0.0-1.0,
      "source_position": [başlangıç_karakter, bitiş_karakter],
      "notes": "Varsa ek bilgi (örn: 'sadece gün ve ay var, yıl belirtilmemiş')"
    }
  ],
  "found": true|false,
  "extraction_notes": "Genel notlar (opsiyonel)"
}

## KRİTİK KURALLAR

1. **TAHMIN ETME**: Sadece metinde AÇIKÇA yazan tarihleri yaz
2. **YIL EKSİKSE**: Yıl belirtilmemişse value'ya null yaz, notes'a "yıl belirtilmemiş" ekle
3. **TARİH ARALIĞI**: "01.06.2025 - 31.08.2025" gibi aralıkları ayrı ayrı kaydet (baslangic + bitis)
4. **GÜN/AY FORMATI**: Türkçe format kullan (DD.MM.YYYY)
5. **SÜRE vs TARİH**: "180 gün" gibi süreler tarih DEĞİL, kaydetme
6. **CONTEXT**: Tarihin anlaşılması için gerekli bağlamı ekle
7. **CONFIDENCE**: 
   - 1.0: Tarih açık ve net
   - 0.8: Tarih var ama format belirsiz
   - 0.6: Dolaylı ifade ("gelecek ayın 15'i" gibi)
   - 0.4: Belirsiz veya eksik

## ÖRNEK GİRDİ/ÇIKTI

Girdi: "İhale 15.03.2025 tarihinde saat 10:00'da yapılacaktır. Sözleşme süresi 01.06.2025 - 31.05.2026 tarihleri arasıdır."

Çıktı:
{
  "dates": [
    {
      "type": "ihale_tarihi",
      "value": "15.03.2025",
      "raw_text": "15.03.2025",
      "context": "İhale 15.03.2025 tarihinde saat 10:00'da yapılacaktır",
      "confidence": 1.0,
      "source_position": [6, 16]
    },
    {
      "type": "baslangic",
      "value": "01.06.2025",
      "raw_text": "01.06.2025",
      "context": "Sözleşme süresi 01.06.2025 - 31.05.2026 tarihleri arasıdır",
      "confidence": 1.0,
      "source_position": [71, 81]
    },
    {
      "type": "bitis",
      "value": "31.05.2026",
      "raw_text": "31.05.2026",
      "context": "Sözleşme süresi 01.06.2025 - 31.05.2026 tarihleri arasıdır",
      "confidence": 1.0,
      "source_position": [84, 94]
    }
  ],
  "found": true
}

---

Sadece JSON döndür, başka açıklama ekleme.

METİN:
`;

export const DATES_SCHEMA = {
  type: 'object',
  required: ['dates', 'found'],
  properties: {
    dates: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'value', 'context', 'confidence'],
        properties: {
          type: {
            type: 'string',
            enum: ['ihale_tarihi', 'baslangic', 'bitis', 'teslim', 'son_basvuru', 'sozlesme', 'ilan', 'diger'],
          },
          value: { type: ['string', 'null'] },
          raw_text: { type: 'string' },
          context: { type: 'string', maxLength: 200 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_position: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          notes: { type: 'string' },
        },
      },
    },
    found: { type: 'boolean' },
    extraction_notes: { type: 'string' },
  },
};

export default {
  prompt: DATES_PROMPT,
  schema: DATES_SCHEMA,
  type: 'dates',
};
