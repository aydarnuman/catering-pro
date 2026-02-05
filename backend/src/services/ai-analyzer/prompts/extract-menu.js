/**
 * Menü/Yemek Extraction Prompt - Micro-extraction (Catering-spesifik)
 *
 * Menü, gramaj, öğün, kalori ve malzeme kalitesi bilgilerini çıkarır.
 */

export const MENU_PROMPT = `Bu metinden SADECE menü ve yemek hizmeti bilgilerini çıkar.

## BİLGİ TÜRLERİ

### 1. ÖĞÜN BİLGİLERİ
- Öğün türü (kahvaltı, öğle, akşam, ara öğün, diyet, gece)
- Günlük öğün sayısı
- Kişi sayısı
- Toplam öğün miktarı

### 2. GRAMAJ BİLGİLERİ
- Et gramajları (dana, kuzu, tavuk, balık)
- Garnitür gramajları
- Ekmek, pilav, makarna gramajları
- İçecek miktarları

### 3. KALORİ DEĞERLERİ
- Öğün başına kalori
- Günlük toplam kalori
- Diyet kalori limitleri

### 4. MALZEME KALİTESİ
- Et kalitesi (1. kalite, dana but vs.)
- Yağ türü (zeytinyağı, ayçiçek)
- Taze/dondurulmuş tercihleri

### 5. MENÜ ÇEŞİTLERİ
- Çorba seçenekleri
- Ana yemek seçenekleri
- Tatlı seçenekleri
- Salata seçenekleri

## ÇIKTI FORMATI

JSON formatında döndür:
{
  "meals": [
    {
      "type": "kahvalti|ogle|aksam|ara_ogun|diyet|gece",
      "daily_count": 1500,
      "person_count": 500,
      "total_count": 450000,
      "period": "Hizmet süresi (örn: 300 gün)",
      "context": "Bu bilginin geçtiği cümle"
    }
  ],
  "gramaj": [
    {
      "item": "dana eti|tavuk|kuzu|balık|pilav|makarna|ekmek|...",
      "weight": 150,
      "unit": "gram|ml|adet|dilim",
      "meal_type": "ogle|aksam|kahvalti|genel",
      "preparation": "Varsa hazırlama şekli (kızartma, haşlama, ızgara)",
      "context": "Bu gramajın geçtiği cümle",
      "confidence": 0.0-1.0,
      "source_position": [başlangıç, bitiş]
    }
  ],
  "calories": [
    {
      "meal_type": "kahvalti|ogle|aksam|gunluk",
      "min_value": 400,
      "max_value": 600,
      "unit": "kcal",
      "context": "Bu kalorin geçtiği cümle"
    }
  ],
  "quality_requirements": [
    {
      "item": "dana eti|zeytinyağı|un|...",
      "requirement": "Kalite gereksinimi açıklaması",
      "standard": "Varsa TSE veya standart numarası",
      "context": "Bu gereksinimin geçtiği cümle"
    }
  ],
  "menu_options": [
    {
      "course": "corba|ana_yemek|yan_yemek|salata|tatli|icecek",
      "options": ["Seçenek 1", "Seçenek 2"],
      "selection_count": "Kaç seçenek sunulmalı",
      "context": "Bu menü bilgisinin geçtiği cümle"
    }
  ],
  "service_times": {
    "kahvalti": "06:30-08:00",
    "ogle": "12:00-13:30",
    "aksam": "18:00-19:30"
  },
  "found": true|false,
  "extraction_notes": "Genel notlar"
}

## KRİTİK KURALLAR

1. **GRAMAJ DOĞRULUĞU**: Gramajlar kritik - sadece açıkça yazanları al
2. **ÖĞÜN vs KİŞİ**: "1500 öğün" ile "1500 kişi" FARKLI - dikkatli ol
3. **PİŞİRME YÖNTEMİ**: Gramaj pişmiş mi çiğ mi? Belirtilmişse kaydet
4. **DİYET ÖĞÜNLER**: Normal ve diyet öğünleri AYRI kaydet
5. **CONFIDENCE**: Tablo verisinden alınan bilgi 1.0, metin içinden 0.8
6. **ISI DEĞERLERİ YASAK**: °C, derece, sıcaklık değerlerini GRAMAJ listesine EKLEME. Bunlar servis sıcaklığıdır, gramaj değildir. (Örn: 65°C, +4°C, 10 derece gramaj DEĞİLDİR)
7. **OPERASYONEL DETAYLAR YASAK**: Bulaşık, servis arabası, personel sayısı gibi operasyonel detayları gramaj listesine EKLEME
8. **ARALIK DEĞERLERİ**: Sayı aralıklarını (örn: 55-60) matematiksel işlem yapmadan STRING olarak ver: "55-60"

## ÖRNEK GİRDİ/ÇIKTI

Girdi: "Öğle yemeği günlük 800 kişiliktir. Dana eti porsiyonu en az 150 gram (pişmiş ağırlık), tavuk 120 gram olacaktır. Zeytinyağı riviera kalite kullanılacaktır. Öğle yemeği 12:00-13:30 saatleri arasında servis edilecektir."

Çıktı:
{
  "meals": [
    {
      "type": "ogle",
      "daily_count": 800,
      "person_count": 800,
      "context": "Öğle yemeği günlük 800 kişiliktir"
    }
  ],
  "gramaj": [
    {
      "item": "dana eti",
      "weight": 150,
      "unit": "gram",
      "meal_type": "ogle",
      "preparation": "pişmiş ağırlık",
      "context": "Dana eti porsiyonu en az 150 gram (pişmiş ağırlık)",
      "confidence": 1.0,
      "source_position": [42, 85]
    },
    {
      "item": "tavuk",
      "weight": 120,
      "unit": "gram",
      "meal_type": "ogle",
      "preparation": null,
      "context": "tavuk 120 gram olacaktır",
      "confidence": 1.0,
      "source_position": [87, 111]
    }
  ],
  "quality_requirements": [
    {
      "item": "zeytinyağı",
      "requirement": "riviera kalite",
      "standard": null,
      "context": "Zeytinyağı riviera kalite kullanılacaktır"
    }
  ],
  "service_times": {
    "ogle": "12:00-13:30"
  },
  "found": true
}

---

Sadece JSON döndür, başka açıklama ekleme.

METİN:
`;

export const MENU_SCHEMA = {
  type: 'object',
  required: ['found'],
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['kahvalti', 'ogle', 'aksam', 'ara_ogun', 'diyet', 'gece'],
          },
          daily_count: { type: 'number' },
          person_count: { type: 'number' },
          total_count: { type: 'number' },
          period: { type: 'string' },
          context: { type: 'string' },
        },
      },
    },
    gramaj: {
      type: 'array',
      items: {
        type: 'object',
        required: ['item', 'weight', 'unit'],
        properties: {
          item: { type: 'string' },
          weight: { type: 'number' },
          unit: { type: 'string', enum: ['gram', 'ml', 'adet', 'dilim', 'porsiyon'] },
          meal_type: { type: 'string' },
          preparation: { type: ['string', 'null'] },
          context: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          source_position: { type: 'array', items: { type: 'number' } },
        },
      },
    },
    calories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          meal_type: { type: 'string' },
          min_value: { type: 'number' },
          max_value: { type: 'number' },
          unit: { type: 'string' },
          context: { type: 'string' },
        },
      },
    },
    quality_requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          requirement: { type: 'string' },
          standard: { type: ['string', 'null'] },
          context: { type: 'string' },
        },
      },
    },
    menu_options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          course: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          selection_count: { type: ['string', 'number'] },
          context: { type: 'string' },
        },
      },
    },
    service_times: {
      type: 'object',
      properties: {
        kahvalti: { type: 'string' },
        ogle: { type: 'string' },
        aksam: { type: 'string' },
      },
    },
    found: { type: 'boolean' },
    extraction_notes: { type: 'string' },
  },
};

export default {
  prompt: MENU_PROMPT,
  schema: MENU_SCHEMA,
  type: 'menu',
};
