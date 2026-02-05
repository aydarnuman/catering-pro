/**
 * Tam Kapsamlı Extraction Prompt
 *
 * Tüm alanları tek seferde çıkarır (mevcut davranış).
 * Hızlı genel analiz için kullanılır.
 */

export const FULL_PROMPT = `Bu metin bir YEMEK/CATERİNG ihale dökümanının bir parçasıdır.

GÖREV: Bu parçadan aşağıdaki bilgileri çıkar. Sadece bu parçada olan bilgileri yaz, tahmin yapma.

JSON formatında döndür:
{
  "ozet": "Bu parçanın 1-2 cümlelik özeti",
  "icerik_tipi": "tablo|teknik|idari|liste|genel",
  
  "tarihler": [
    {
      "type": "ihale_tarihi|baslangic|bitis|teslim|son_basvuru",
      "value": "DD.MM.YYYY",
      "context": "Tarihin geçtiği cümle"
    }
  ],
  
  "tutarlar": [
    {
      "type": "birim_fiyat|toplam_bedel|yaklasik_maliyet|teminat",
      "value": "1.250.000,00",
      "currency": "TL",
      "includes_kdv": true|false|null,
      "context": "Tutarın geçtiği cümle"
    }
  ],
  
  "cezalar": [
    {
      "type": "gecikme|eksik_hizmet|kalite_ihlali|genel",
      "rate": "%2,5 veya on binde 2",
      "period": "günlük|aylık|tek_sefer",
      "context": "Cezanın geçtiği cümle"
    }
  ],
  
  "teknik_sartlar": [
    "Gramajlar, malzeme kalitesi, saklama koşulları vb."
  ],
  
  "birim_fiyatlar": [
    {
      "kalem": "Ürün/hizmet adı",
      "miktar": "1000",
      "birim": "porsiyon|kg|adet",
      "fiyat": "15,50 TL"
    }
  ],
  
  "personel_detaylari": [
    {
      "pozisyon": "Aşçı|Garson|vb",
      "adet": 6,
      "ucret_orani": "%85 fazlası"
    }
  ],
  
  "ogun_bilgileri": [
    {
      "tur": "Kahvaltı|Öğle|Akşam|Diyet",
      "miktar": 1000,
      "birim": "öğün|kişi"
    }
  ],
  
  "gramaj_bilgileri": [
    {
      "malzeme": "dana eti|tavuk|balık|pilav",
      "gramaj": 150,
      "birim": "gram|ml"
    }
  ],
  
  "iletisim": {
    "telefon": "",
    "email": "",
    "adres": "",
    "yetkili": ""
  },
  
  "mali_kriterler": {
    "cari_oran": "0.75",
    "ozkaynak_orani": "0.15",
    "is_deneyimi": "%20"
  },
  
  "gerekli_belgeler": [
    {
      "belge": "TS 13075 Hizmet Yeri Yeterlilik Belgesi",
      "zorunlu": true
    }
  ],
  
  "teminat_oranlari": {
    "gecici": "%3",
    "kesin": "%6"
  },
  
  "servis_saatleri": {
    "kahvalti": "06:00-07:00",
    "ogle": "12:00-14:00",
    "aksam": "17:00-19:00"
  },
  
  "onemli_notlar": [
    "Kritik notlar, uyarılar"
  ],
  
  "referanslar": [
    {
      "target": "Madde 8",
      "context": "Bu maddeye atıf yapılan cümle"
    }
  ]
}

KURALLAR:
- KRİTİK ALANLAR (mutlaka doldur, metinde varsa):
  * iletisim: İdari şartnamelerde MUTLAKA telefon, adres, email vardır
  * teminat_oranlari: Geçici %3, kesin %6 gibi - ihale şartnamelerinde zorunlu
  * servis_saatleri: Catering ihalelerinde kahvaltı/öğle/akşam saatleri belirtilir
  * tahmini_bedel: Yaklaşık maliyet değeri
- Bu alanlar metinde yoksa "Belirtilmemiş" yaz, BOŞ BIRAKMA
- Diğer alanlar için bulunamadıysa boş array [] veya object {} kullan
- Sadece JSON döndür, başka açıklama ekleme
- Tahmin yapma, sadece metinde açıkça yazan bilgileri al

DÖKÜMAN PARÇASI:
`;

export const FULL_SCHEMA = {
  type: 'object',
  required: ['ozet', 'icerik_tipi'],
  properties: {
    ozet: { type: 'string' },
    icerik_tipi: {
      type: 'string',
      enum: ['tablo', 'teknik', 'idari', 'liste', 'genel'],
    },
    tarihler: { type: 'array' },
    tutarlar: { type: 'array' },
    cezalar: { type: 'array' },
    teknik_sartlar: { type: 'array', items: { type: 'string' } },
    birim_fiyatlar: { type: 'array' },
    personel_detaylari: { type: 'array' },
    ogun_bilgileri: { type: 'array' },
    gramaj_bilgileri: { type: 'array' },
    iletisim: { type: 'object' },
    mali_kriterler: { type: 'object' },
    gerekli_belgeler: { type: 'array' },
    teminat_oranlari: { type: 'object' },
    servis_saatleri: { type: 'object' },
    onemli_notlar: { type: 'array', items: { type: 'string' } },
    referanslar: { type: 'array' },
  },
};

export default {
  prompt: FULL_PROMPT,
  schema: FULL_SCHEMA,
  type: 'full',
};
