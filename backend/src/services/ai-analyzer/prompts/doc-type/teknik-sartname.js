/**
 * Teknik Şartname Extraction Prompt
 *
 * Teknik şartname, personel detayları, öğün bilgileri, gramaj,
 * servis saatleri, kalite standartları ve ekipman gereksinimlerini içerir.
 */

export const TEKNIK_PROMPT = `Bu metin bir CATERİNG/YEMEK ihalesinin TEKNİK ŞARTNAMESİDİR.

Teknik şartname; personel, öğün, gramaj, servis saatleri, kalite ve ekipman detaylarını içerir.

## GÖREV: Aşağıdaki bilgileri çıkar.

JSON formatında döndür:
{
  "ozet": "Teknik şartnamenin 2-3 cümlelik özeti",
  
  "personel_detaylari": [
    {
      "pozisyon": "Tam pozisyon adı (Aşçıbaşı, Aşçı, Garson, Diyetisyen vb.)",
      "adet": "Sayı (rakam olarak)",
      "ucret_orani": "Asgari ücretin yüzde fazlası (örn: %85 fazlası)",
      "nitelik": "Gereken deneyim/sertifika/eğitim",
      "vardiya": "Çalışma düzeni (varsa)"
    }
  ],
  "toplam_personel": "Toplam personel sayısı",
  
  "ogun_bilgileri": [
    {
      "tur": "Kahvaltı / Öğle / Akşam / Diyet / Ara Öğün / Gece / Kumanya",
      "kisi_sayisi": "Günlük kişi sayısı",
      "miktar": "Toplam öğün miktarı",
      "birim": "adet / öğün / porsiyon",
      "aciklama": "Ek detay"
    }
  ],
  
  "servis_bilgileri": {
    "servis_saatleri": {
      "kahvalti": "Saat aralığı (örn: 06:30-08:30)",
      "ogle": "Saat aralığı (örn: 11:30-13:30)",
      "aksam": "Saat aralığı (örn: 17:30-19:30)",
      "ara_ogun": "Saat aralığı (varsa)",
      "gece": "Saat aralığı (varsa)"
    },
    "servis_tipi": "tabldot / self servis / taşımalı / yerinde pişirme",
    "dagitim_yontemi": "Dağıtım detayları",
    "is_yerleri": ["Hizmet verilecek lokasyonlar listesi"]
  },
  
  "gramaj_bilgileri": [
    {
      "yemek": "Yemek/malzeme adı",
      "cig_gramaj": "Çiğ gramaj (gr)",
      "pismis_gramaj": "Pişmiş gramaj (gr)",
      "porsiyon": "Porsiyon bilgisi"
    }
  ],
  
  "menu_bilgileri": {
    "yemek_cesit_sayisi": "Günlük/öğün başına yemek çeşidi",
    "menu_dongusu": "Haftalık/aylık menü döngüsü",
    "ozel_gunler": "Ramazan, bayram gibi özel gün menüleri",
    "diyet_menu": "Diyet menü gereksinimleri"
  },
  
  "kalite_gereksinimleri": {
    "sertifikalar": ["ISO 22000", "HACCP", "TS 13075", "vb."],
    "hijyen_kurallari": ["Hijyen ile ilgili kurallar"],
    "gida_guvenligi": ["Gıda güvenliği gereksinimleri"],
    "denetim": "Denetim/kontrol mekanizması"
  },
  
  "ekipman_gereksinimleri": [
    "Yüklenicinin sağlaması gereken ekipmanlar"
  ],
  
  "mutfak_bilgileri": {
    "mutfak_tipi": "Merkezi mutfak / yerinde mutfak",
    "pisirilecek_yer": "Yüklenici mutfağı / idare mutfağı",
    "tasima_araci": "Yemek taşıma araçları gereksinimleri"
  },
  
  "teknik_sartlar": [
    {
      "madde": "Teknik şart açıklaması",
      "kategori": "gramaj / hijyen / ekipman / saklama / servis / personel / kalite / genel",
      "onem": "kritik / normal / bilgi"
    }
  ],
  
  "onemli_notlar": [
    {
      "not": "Önemli teknik koşul",
      "tur": "uyari / gereklilik / bilgi / kisitlama"
    }
  ]
}

## KRİTİK KURALLAR:
1. PERSONEL: Her pozisyonun adını, sayısını ve ücret oranını çıkar
2. SERVİS SAATLERİ: Kahvaltı/öğle/akşam/ara öğün saatlerini tam yaz
3. GRAMAJ: Çiğ ve pişmiş gramajları ayrı ayrı yaz
4. ÖĞÜN: Her öğün türü için kişi sayısını ve toplam miktarı ayır
5. İŞ YERLERİ: Tüm lokasyonları listele
6. Metinde olmayan bilgiler için boş string/array kullan
7. Sadece JSON döndür

## TEKNİK ŞARTNAME METNİ:
`;

export const TEKNIK_SCHEMA = {
  type: 'object',
  required: ['ozet', 'personel_detaylari', 'servis_bilgileri'],
};

export default {
  prompt: TEKNIK_PROMPT,
  schema: TEKNIK_SCHEMA,
  type: 'teknik_sartname',
};
