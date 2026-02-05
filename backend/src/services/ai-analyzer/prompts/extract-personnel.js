/**
 * Personel Extraction Prompt - Micro-extraction
 *
 * Personel sayısı, nitelikleri ve çalışma koşullarını çıkarır.
 */

export const PERSONNEL_PROMPT = `Bu metinden SADECE personel ve çalışan bilgilerini çıkar.

## BİLGİ TÜRLERİ

### 1. PERSONEL SAYILARI
- Pozisyon bazında sayılar
- Minimum/maksimum sayılar
- Vardiya bazında dağılım

### 2. NİTELİKLER
- Eğitim gereksinimleri
- Sertifikalar (hijyen, ustalık vb.)
- Deneyim şartları
- Sağlık raporları

### 3. ÇALIŞMA KOŞULLARI
- Çalışma saatleri
- Vardiya düzeni
- Kıyafet/üniforma
- Sigorta gereksinimleri

### 4. ÜCRET BİLGİLERİ
- Asgari ücret oranları
- Fazla mesai
- Yol/yemek yardımı

## ÇIKTI FORMATI

JSON formatında döndür:
{
  "personnel": [
    {
      "position": "asci|asci_yardimcisi|garson|bulasikci|depocu|sef|diyetisyen|gida_muhendisi|temizlik|sofor|diger",
      "count": 5,
      "min_count": 4,
      "max_count": 6,
      "shift": "gündüz|gece|vardiyalı|tam_zamanlı",
      "context": "Bu bilginin geçtiği cümle",
      "confidence": 0.0-1.0,
      "source_position": [başlangıç, bitiş]
    }
  ],
  "qualifications": [
    {
      "position": "Hangi pozisyon için",
      "requirement_type": "egitim|sertifika|deneyim|saglik|diger",
      "requirement": "Gereksinim açıklaması",
      "mandatory": true|false,
      "context": "Bu gereksinimin geçtiği cümle"
    }
  ],
  "working_conditions": [
    {
      "type": "calisma_saati|vardiya|kiyafet|sigorta|izin|diger",
      "description": "Koşul açıklaması",
      "context": "Bu koşulun geçtiği cümle"
    }
  ],
  "wage_info": [
    {
      "position": "Hangi pozisyon için (veya 'genel')",
      "wage_type": "asgari_ucret_orani|sabit|saat_bazli",
      "rate": "%85 fazlası veya tutar",
      "extras": ["yol", "yemek", "fazla_mesai"],
      "context": "Bu ücret bilgisinin geçtiği cümle"
    }
  ],
  "total_personnel_count": 25,
  "found": true|false,
  "extraction_notes": "Genel notlar"
}

## KRİTİK KURALLAR

1. **POZİSYON DOĞRULUĞU**: Her pozisyonu ayrı kaydet, genel "personel" olarak birleştirme
2. **MİN/MAX AYRIMI**: "en az 5" ile "5 kişi" FARKLI - min_count vs count
3. **SERTİFİKA**: Hangi sertifika, hangi pozisyon için gerekli - net belirt
4. **ÜCRET ORANI**: "asgari ücretin %85 fazlası" gibi ifadeleri tam yaz
5. **ZORUNLU/TERCİH**: Zorunlu ve tercih edilen nitelikleri ayır (mandatory)

## ÖRNEK GİRDİ/ÇIKTI

Girdi: "Yüklenici en az 3 aşçı, 5 garson ve 2 bulaşıkçı çalıştıracaktır. Aşçıların ustalık belgesi, tüm personelin hijyen sertifikası olmalıdır. Personel ücreti asgari ücretin %85 fazlası olarak belirlenmiştir. Çalışma saatleri 06:00-22:00 arasındadır."

Çıktı:
{
  "personnel": [
    {
      "position": "asci",
      "count": null,
      "min_count": 3,
      "max_count": null,
      "shift": null,
      "context": "Yüklenici en az 3 aşçı çalıştıracaktır",
      "confidence": 1.0,
      "source_position": [0, 25]
    },
    {
      "position": "garson",
      "count": 5,
      "min_count": null,
      "max_count": null,
      "shift": null,
      "context": "5 garson çalıştıracaktır",
      "confidence": 1.0,
      "source_position": [27, 35]
    },
    {
      "position": "bulasikci",
      "count": 2,
      "min_count": null,
      "max_count": null,
      "shift": null,
      "context": "2 bulaşıkçı çalıştıracaktır",
      "confidence": 1.0,
      "source_position": [40, 55]
    }
  ],
  "qualifications": [
    {
      "position": "asci",
      "requirement_type": "sertifika",
      "requirement": "ustalık belgesi",
      "mandatory": true,
      "context": "Aşçıların ustalık belgesi olmalıdır"
    },
    {
      "position": "genel",
      "requirement_type": "sertifika",
      "requirement": "hijyen sertifikası",
      "mandatory": true,
      "context": "tüm personelin hijyen sertifikası olmalıdır"
    }
  ],
  "working_conditions": [
    {
      "type": "calisma_saati",
      "description": "06:00-22:00",
      "context": "Çalışma saatleri 06:00-22:00 arasındadır"
    }
  ],
  "wage_info": [
    {
      "position": "genel",
      "wage_type": "asgari_ucret_orani",
      "rate": "%85 fazlası",
      "extras": [],
      "context": "Personel ücreti asgari ücretin %85 fazlası olarak belirlenmiştir"
    }
  ],
  "total_personnel_count": 10,
  "found": true
}

---

Sadece JSON döndür, başka açıklama ekleme.

METİN:
`;

export const PERSONNEL_SCHEMA = {
  type: 'object',
  required: ['found'],
  properties: {
    personnel: {
      type: 'array',
      items: {
        type: 'object',
        required: ['position'],
        properties: {
          position: {
            type: 'string',
            enum: [
              'asci',
              'asci_yardimcisi',
              'garson',
              'bulasikci',
              'depocu',
              'sef',
              'diyetisyen',
              'gida_muhendisi',
              'temizlik',
              'sofor',
              'diger',
            ],
          },
          count: { type: ['number', 'null'] },
          min_count: { type: ['number', 'null'] },
          max_count: { type: ['number', 'null'] },
          shift: { type: ['string', 'null'] },
          context: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_position: { type: 'array', items: { type: 'number' } },
        },
      },
    },
    qualifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          position: { type: 'string' },
          requirement_type: {
            type: 'string',
            enum: ['egitim', 'sertifika', 'deneyim', 'saglik', 'diger'],
          },
          requirement: { type: 'string' },
          mandatory: { type: 'boolean' },
          context: { type: 'string' },
        },
      },
    },
    working_conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['calisma_saati', 'vardiya', 'kiyafet', 'sigorta', 'izin', 'diger'],
          },
          description: { type: 'string' },
          context: { type: 'string' },
        },
      },
    },
    wage_info: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          position: { type: 'string' },
          wage_type: { type: 'string' },
          rate: { type: 'string' },
          extras: { type: 'array', items: { type: 'string' } },
          context: { type: 'string' },
        },
      },
    },
    total_personnel_count: { type: ['number', 'null'] },
    found: { type: 'boolean' },
    extraction_notes: { type: 'string' },
  },
};

export default {
  prompt: PERSONNEL_PROMPT,
  schema: PERSONNEL_SCHEMA,
  type: 'personnel',
};
