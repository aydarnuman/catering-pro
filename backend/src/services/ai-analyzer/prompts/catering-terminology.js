/**
 * Catering İhale Terminolojisi
 * ============================
 *
 * 5. Prompt Optimizasyonu - Catering spesifik terimler
 *
 * Bu dosya catering ihalelerinde sık kullanılan terimleri ve
 * bunların nasıl çıkarılacağını tanımlar.
 */

// ═══════════════════════════════════════════════════════════════════════════
// CATERİNG TERMİNOLOJİSİ
// ═══════════════════════════════════════════════════════════════════════════

export const CATERING_TERMINOLOGY = {
  // Öğün türleri
  meal_types: {
    kahvalti: ['kahvaltı', 'sabah yemeği', 'breakfast'],
    ogle: ['öğle yemeği', 'öğlen', 'lunch', 'günlük yemek'],
    aksam: ['akşam yemeği', 'akşam', 'dinner'],
    ara_ogun: ['ara öğün', 'aperatif', 'snack', 'ikindi'],
    gece: ['gece yemeği', 'gece öğünü', 'night meal'],
    diyet: ['diyet yemeği', 'rejim yemeği', 'diet meal', 'diyet kahvaltı', 'diyet öğle', 'diyet akşam'],
    rejim: ['rejim-1', 'rejim-2', 'özel rejim'],
    kumanya: ['kumanya', 'paket yemek', 'sefertası'],
  },

  // Personel pozisyonları
  personnel_positions: {
    kitchen: [
      'aşçı',
      'aşçıbaşı',
      'şef',
      'mutfak şefi',
      'soğuk mutfak',
      'sıcak mutfak',
      'pastane şefi',
      'aşçı yardımcısı',
      'aşçı kalfa',
      'hazırlıkçı',
    ],
    service: ['garson', 'servis elemanı', 'servis personeli', 'komi', 'hostes', 'sunucu'],
    support: ['bulaşıkçı', 'temizlik personeli', 'temizlikçi', 'depocu', 'taşıyıcı', 'şoför'],
    specialist: [
      'diyetisyen',
      'gıda mühendisi',
      'gıda teknikeri',
      'kalite kontrol',
      'hijyen uzmanı',
      'HACCP sorumlusu',
    ],
    management: ['müdür', 'şef', 'sorumlu', 'koordinatör', 'proje yöneticisi', 'saha amiri'],
  },

  // Gıda kalite standartları
  quality_standards: {
    certifications: [
      'ISO 22000',
      'ISO 9001',
      'HACCP',
      'TSE',
      'Helal sertifikası',
      'Organik sertifika',
      'GMP',
      'BRC',
      'IFS',
    ],
    hygiene: ['hijyen belgesi', 'sağlık karnesi', 'portör muayene', 'gıda güvenliği', 'dezenfeksiyon', 'sanitasyon'],
    documents: [
      'işyeri açma izni',
      'işletme kayıt belgesi',
      'gıda üretim izni',
      'kapasite raporu',
      'TS 8985',
      'TS 13075',
      'TS 13027',
    ],
  },

  // Yemek servisi terimleri
  service_terms: {
    service_types: ['tabldot', 'alakart', 'büfe', 'self servis', 'masaya servis', 'taşımalı', 'yerinde pişirme'],
    equipment: ['benmari', 'şofing', 'gastronom küvet', 'termos', 'soğuk vitrin', 'sıcak vitrin', 'buzdolabı'],
    packaging: ['tek kullanımlık', 'disposable', 'termobox', 'vakumlu paket', 'kapaklı kap', 'köpük tabak'],
  },

  // Gramaj ve porsiyon terimleri
  portion_terms: {
    units: ['gram', 'gr', 'g', 'kg', 'kilogram', 'ml', 'lt', 'litre', 'adet', 'porsiyon', 'kişilik'],
    portion_sizes: ['standart porsiyon', 'tek kişilik', 'çift kişilik', 'aile boyu'],
    serving: ['servis gramajı', 'pişmiş gramaj', 'çiğ gramaj', 'net gramaj'],
  },

  // Fiyatlandırma terimleri
  pricing_terms: {
    cost_types: ['birim fiyat', 'öğün fiyatı', 'kişi başı fiyat', 'günlük maliyet', 'aylık maliyet', 'yıllık maliyet'],
    cost_components: [
      'çiğ girdi maliyeti',
      'ana girdi',
      'yardımcı girdi',
      'işçilik maliyeti',
      'genel giderler',
      'kar marjı',
      'KDV',
      'sözleşme gideri',
      'nakliye',
    ],
    calculation: [
      'yaklaşık maliyet',
      'tahmini bedel',
      'sınır değer',
      'aşırı düşük sınır',
      'birim fiyat teklif cetveli',
    ],
  },

  // Teminat terimleri
  guarantee_terms: [
    'geçici teminat',
    'kesin teminat',
    'ek kesin teminat',
    'avans teminatı',
    'teminat mektubu',
    'teminat oranı',
  ],

  // Ceza terimleri
  penalty_terms: [
    'gecikme cezası',
    'özel aykırılık',
    'ağır aykırılık',
    'cezai şart',
    'kesinti',
    'puan düşürme',
    'sözleşme feshi',
    'yasaklama',
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// GELİŞTİRİLMİŞ PROMPT ŞABLONLARI
// ═══════════════════════════════════════════════════════════════════════════

export const ENHANCED_STAGE1_PROMPT = `Bu metin bir YEMEK/CATERİNG ihale dökümanının bir parçasıdır.

## CATERİNG TERMİNOLOJİSİ:

**Öğün:** kahvaltı, öğle, akşam, ara öğün, gece, diyet, rejim-1/2, kumanya
**Personel:** aşçı, aşçıbaşı, garson, diyetisyen, gıda mühendisi, bulaşıkçı, temizlikçi, şoför
**Kalite:** ISO 22000, HACCP, TS 8985, TS 13075, hijyen belgesi
**Servis:** tabldot, self servis, taşımalı, yerinde pişirme, benmari, termobox
**Mali:** çiğ girdi, işçilik, genel gider, cari oran, özkaynak oranı, sınır değer katsayısı (R)

## GÖREV: Bu parçadan aşağıdaki bilgileri çıkar.

JSON formatında döndür:
{
  "ozet": "Bu parçanın 1-2 cümlelik özeti",
  "icerik_tipi": "tablo/teknik/idari/liste/genel/sozlesme/birim_fiyat",
  
  "teknik_sartlar": [
    {"madde": "Teknik şart veya gereksinim açıklaması", "kategori": "gramaj/hijyen/ekipman/saklama/servis/personel/kalite/kapasite/belge/genel"}
  ],
  
  "birim_fiyatlar": [
    {"kalem": "Öğün/hizmet adı", "miktar": "sayı", "birim": "öğün/adet/ay", "birim_fiyat": "TL", "toplam": "TL"}
  ],
  
  "tarihler": [
    {"olay": "İhale/başlangıç/bitiş/teslim/son başvuru", "tarih": "GG.AA.YYYY", "sure_gun": "sayı"}
  ],
  
  "personel_detaylari": [
    {"pozisyon": "Aşçı/Garson/Diyetisyen", "adet": 6, "ucret_orani": "%85 fazlası", "nitelik": "Gereken deneyim/sertifika"}
  ],
  
  "ogun_bilgileri": [
    {"tur": "Kahvaltı/Öğle/Akşam/Diyet/Ara öğün", "miktar": 1000, "birim": "öğün/kişi/gün"}
  ],
  
  "gramaj_bilgileri": [
    {"yemek": "Yemek adı", "cig_gramaj": "gr", "pismis_gramaj": "gr", "porsiyon": "kişilik"}
  ],
  
  "iletisim": {
    "telefon": "",
    "faks": "",
    "email": "",
    "adres": "",
    "yetkili": ""
  },
  
  "mali_kriterler": {
    "cari_oran": "",
    "ozkaynak_orani": "",
    "is_deneyimi": "",
    "banka_borc_orani": "",
    "toplam_ciro_orani": "",
    "hizmet_ciro_orani": ""
  },
  
  "ceza_kosullari": [
    {"tur": "gecikme/ozel_aykirilik/agir_aykirilik/sozlesme_feshi", "oran": "binde 5 / %1 vb.", "baz": "sözleşme bedeli/günlük bedel", "aciklama": "Detay", "limit": "max %30 gibi"}
  ],
  
  "gerekli_belgeler": [
    {"belge": "Belge adı", "zorunlu": true, "aciklama": "Detay"}
  ],
  
  "teminat_oranlari": {
    "gecici": "",
    "kesin": "",
    "ek_kesin": ""
  },
  
  "servis_saatleri": {
    "kahvalti": "",
    "ogle": "",
    "aksam": "",
    "ara_ogun": ""
  },
  
  "onemli_notlar": [
    {"not": "Önemli bilgi", "tur": "uyari/gereklilik/bilgi/kisitlama"}
  ],
  
  "kalite_sertifikalari": [],

  "sinir_deger_katsayisi": "",
  "benzer_is_tanimi": "",
  "kapasite_gereksinimi": "",
  "teklif_turu": "",
  "ihale_usulu": "",
  
  "fiyat_farki": {
    "uygulanacak_mi": "",
    "formul": "",
    "aciklama": ""
  },
  
  "odeme_kosullari": {
    "hakedis_suresi": "",
    "odeme_suresi": "",
    "avans": ""
  },
  
  "is_artisi": {
    "oran": "",
    "kosullar": ""
  }
}

## KURALLAR:
1. **KRİTİK ALANLAR** - Metinde varsa MUTLAKA doldur:
   - iletisim: Telefon numarasını AYNEN yaz (rakamları değiştirme)
   - teminat_oranlari: Yüzde değerlerini yaz
   - mali_kriterler: Cari oran, özkaynak, banka borcu, ciro oranlarını SAYI olarak yaz
   - sinir_deger_katsayisi: "Sınır Değer Katsayısı (R)" aranmalı - teklif stratejisi için kritik
   - ceza_kosullari: Oran, baz ve üst limit bilgilerini mutlaka yaz

2. **PLACEHOLDER KULLANMA:**
   - Metinde olmayan bilgiler için boş string "" kullan
   - "Belirtilmemiş", "0xxx xxx xx xx", "email@domain.com" gibi placeholder YAZMA
   - Array alanları: bulunamadıysa boş array [] kullan

3. **GRAMAJ:** Çiğ ve pişmiş gramaj farkı önemli
4. **PERSONEL:** Ücret oranlarını yüzde olarak yaz
5. **ÖĞÜN:** Toplam/günlük/aylık farkını belirt
6. **BENZER İŞ:** Tanımı aynen kopyala, kısaltma
7. **KAPASİTE:** Günlük üretim kapasitesini yaz (varsa)

8. Sadece JSON döndür, başka açıklama ekleme.

## DÖKÜMAN PARÇASI:
`;

export const ENHANCED_STAGE2_PROMPT = `Aşağıda bir CATERİNG ihale dökümanının farklı parçalarından çıkarılan analizler var.

## GÖREV: Tüm parçaları birleştirerek kapsamlı bir ihale analizi oluştur.

ÖNEMLİ: Çelişen bilgiler varsa:
- TABLO'dan gelen veriyi tercih et
- Daha DETAYLI olan veriyi tercih et
- Her iki değeri de "notlar" kısmında belirt

JSON formatında döndür:
{
  "ozet": "İhalenin kapsamlı özeti - ne alınacak, nerede, ne kadar süre, kaç kişi",
  "ihale_turu": "hizmet",
  
  "tahmini_bedel": "Yaklaşık maliyet (TL formatında)",
  "teslim_suresi": "Toplam hizmet süresi (ay/yıl)",
  "gunluk_ogun_sayisi": "Günlük toplam öğün",
  "kisi_sayisi": "Günlük/toplam kişi sayısı",
  
  "teknik_sartlar": [
    {"madde": "Şart açıklaması", "onem": "kritik/normal/bilgi", "kategori": "gramaj/hijyen/ekipman"}
  ],
  
  "birim_fiyatlar": [
    {"kalem": "Öğün adı", "miktar": "toplam", "birim": "öğün", "birim_fiyat": "Teklif edilecek", "toplam": "Hesaplanacak"}
  ],
  
  "takvim": [
    {"olay": "İhale tarihi", "tarih": "GG.AA.YYYY", "gun": "gün sayısı"}
  ],
  
  "is_yerleri": ["Hizmet verilecek yerler listesi"],
  
  "ogun_bilgileri": [
    {"tur": "Öğün türü", "miktar": 1000, "birim": "öğün"}
  ],
  
  "personel_detaylari": [
    {"pozisyon": "Pozisyon adı", "adet": 6, "ucret_orani": "%85 fazlası"}
  ],
  
  "iletisim": {
    "adres": "Tam adres",
    "telefon": "Telefon numarası",
    "email": "Email adresi", 
    "yetkili": "Yetkili kişi"
  },
  
  "teminat_oranlari": {
    "gecici": "% değeri",
    "kesin": "% değeri"
  },
  
  "servis_saatleri": {
    "kahvalti": "Saat aralığı",
    "ogle": "Saat aralığı", 
    "aksam": "Saat aralığı"
  },
  
  "mali_kriterler": {
    "cari_oran": "Minimum değer",
    "ozkaynak_orani": "Minimum değer",
    "is_deneyimi": "Oran ve süre",
    "banka_borc_orani": "Üst limit",
    "toplam_ciro_orani": "Yüzde",
    "hizmet_ciro_orani": "Yüzde"
  },
  
  "ceza_kosullari": [
    {"tur": "gecikme/ozel_aykirilik/agir_aykirilik/sozlesme_feshi", "oran": "binde 5 / %1", "baz": "sözleşme bedeli", "aciklama": "Detay", "limit": "max %30"}
  ],
  
  "gerekli_belgeler": [
    {"belge": "Belge adı", "zorunlu": true, "aciklama": "Detay"}
  ],
  
  "onemli_notlar": [
    {"not": "Önemli bilgi", "tur": "uyari/gereklilik/bilgi/kisitlama"}
  ],
  
  "eksik_bilgiler": ["Dökümanda bulunamayan kritik bilgiler listesi"],
  
  "fiyat_farki": {
    "uygulanacak_mi": "evet/hayır",
    "formul": "Formül varsa",
    "katsayilar": {"a1": "", "a2": "", "b1": "", "b2": ""},
    "aciklama": "Detay"
  },
  
  "odeme_kosullari": {
    "hakedis_suresi": "gün",
    "odeme_suresi": "gün",
    "avans": "var/yok"
  },
  
  "is_artisi": {
    "oran": "Maksimum oran",
    "kosullar": "Koşullar"
  },
  
  "benzer_is_tanimi": "Benzer iş tanımı - aynen kopyala",
  "sinir_deger_katsayisi": "R değeri ve türü (örn: 0,79 Malzemeli Yemek)",
  "kapasite_gereksinimi": "Günlük üretim kapasitesi",
  "teklif_turu": "birim_fiyat/goturu_bedel",
  "ihale_usulu": "Açık ihale/Pazarlık"
}

## BİRLEŞTİRME KURALLARI:
1. Aynı bilgi farklı parçalarda varsa → TABLO'dan geleni tercih et
2. Personel listesi → Tüm unique pozisyonları birleştir
3. Öğün bilgileri → Toplam miktarları hesapla
4. Tarihler → En erken/en geç tarihleri belirle
5. Cezalar → Tüm ceza türlerini listele

## PARÇA ANALİZLERİ:
`;

// ═══════════════════════════════════════════════════════════════════════════
// ALAN BAZLI EXTRACTION PROMPTLARI
// ═══════════════════════════════════════════════════════════════════════════

export const FIELD_EXTRACTION_PROMPTS = {
  iletisim: `İletişim bilgilerini çıkar:
- Telefon: 0xxx xxx xx xx formatında
- Faks: varsa
- Email: xxx@domain.com formatında
- Adres: İl, ilçe, cadde/sokak dahil tam adres
- Yetkili: Ad Soyad, unvan

İdari şartname, ilan metni, sözleşme tasarısında aranmalı.`,

  teminat_oranlari: `Teminat oranlarını çıkar:
- Geçici teminat: Genelde %3 civarı
- Kesin teminat: Genelde %6 civarı
- Ek kesin teminat: Varsa

"teminat", "garanti", "güvence" kelimelerini ara.`,

  servis_saatleri: `Servis saatlerini çıkar:
- Kahvaltı: Genelde 06:00-09:00 arası
- Öğle: Genelde 11:00-14:00 arası
- Akşam: Genelde 17:00-20:00 arası
- Ara öğün: Varsa

"servis", "dağıtım", "yemek saati" kelimelerini ara.`,

  mali_kriterler: `Mali yeterlilik kriterlerini çıkar:
- İş deneyimi: Yaklaşık maliyetin %X'i
- Özkaynak oranı: %X
- Cari oran: X
- Banka referans mektubu: Tutar

"yeterlilik", "mali", "ekonomik", "finansal" kelimelerini ara.`,

  tahmini_bedel: `Yaklaşık maliyeti çıkar:
- Para birimi dahil (TL)
- KDV dahil/hariç belirt
- "yaklaşık maliyet", "tahmini bedel", "muhammen bedel" ara

Sayı formatı: 1.234.567,89 TL`,
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  CATERING_TERMINOLOGY,
  ENHANCED_STAGE1_PROMPT,
  ENHANCED_STAGE2_PROMPT,
  FIELD_EXTRACTION_PROMPTS,
};
