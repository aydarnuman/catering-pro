/**
 * AI Prompts - Tüm prompt şablonları
 */

/**
 * İhale dökümanı analiz prompt'u
 */
export const TENDER_ANALYSIS_PROMPT = `Sen bir YEMEK/CATERİNG ihale dökümanı analiz uzmanısın. Bu dökümanı DİKKATLİCE analiz et ve TÜM SOMUT bilgileri eksiksiz çıkar.

ÖNEMLİ TALİMATLAR:
1. Aşağıdaki STANDART/GENEL bilgileri ASLA yazma (bunlar tüm ihalelerde aynı):
   - "EKAP üzerinden teklif verilecek/e-imza ile" 
   - "Açık ihale usulü"
   - "4734 sayılı Kanun kapsamında"
   - "Sözleşme Türkçe hazırlanmış"
   - "Tebligatlar EKAP üzerinden"
   - "EKAP'a kayıt zorunlu"
   - "İhale dokümanı EKAP'ta görülebilir"
   - "Belgeler Türkçe olacak"
   - "İhale tarihinin tatil gününe rastlaması halinde..."
   - "Yerli istekliler katılabilir"
   - "Konsorsiyum olarak teklif verilemez"
   - "Elektronik eksiltme yapılmayacak"
   
2. SADECE BU İHALEYE ÖZGÜ SPESİFİK bilgileri çıkar:
   - Günlük/haftalık/aylık YEMEK SAYISI
   - Kaç KİŞİYE yemek verileceği
   - GRAMAJ bilgileri (et, pilav, salata vb. için gram cinsinden)
   - MENÜ TİPLERİ (kahvaltı, öğle, akşam, ara öğün, diyet)
   - GIDA GÜVENLİĞİ gereksinimleri (ISO, HACCP, sertifikalar)
   - KALORİ ihtiyaçları
   - TESLİMAT saatleri ve yerleri
   - CEZA ŞARTLARI (gecikme, eksik teslimat için TL veya % cinsinden cezalar)
   - ZORUNLU BELGELER listesi

3. teknik_sartlar için: Yemek gramajları, porsiyon boyutları, malzeme kalitesi, saklama koşulları, sıcaklık gereksinimleri gibi SOMUT teknik detaylar
4. notlar için: Sadece İŞ İÇİN KRİTİK bilgiler (cezalar, zorunlu belgeler, özel koşullar)
5. birim_fiyatlar için: Her kalemi TAM olarak çıkar (kalem adı, birim, miktar, fiyat varsa)
6. personel_detaylari için: Her pozisyon için adet, ücret oranı (asgari ücretin yüzdesi)
7. ogun_bilgileri için: Her öğün tipi için toplam miktar (24 aylık veya belirtilen süre)
8. is_yerleri için: Yemek verilecek tüm lokasyonları listele
9. mali_kriterler için: Cari oran, öz kaynak oranı, iş deneyimi yüzdesi gibi mali yeterlilik şartları
10. ceza_kosullari için: Tüm ceza oranlarını ve koşullarını çıkar
11. fiyat_farki için: Formül ve tüm katsayıları (a1, b1, b2, b3, c vb.)
12. gerekli_belgeler için: İstenen tüm sertifika, belge ve izinleri listele
13. teminat_oranlari için: Geçici ve kesin teminat oranlarını çıkar
14. servis_saatleri için: Kahvaltı, öğle, akşam servis saatlerini çıkar

JSON formatında yanıt ver:
{
  "tam_metin": "Kısa ve öz ihale özeti (max 500 karakter)",
  "ihale_basligi": "",
  "kurum": "",
  "tarih": "",
  "bedel": "",
  "sure": "",
  "ikn": "",
  "gunluk_ogun_sayisi": "",
  "kisi_sayisi": "",
  "teknik_sartlar": ["SOMUT teknik şart 1", "SOMUT teknik şart 2"],
  "birim_fiyatlar": [{"kalem": "Ürün adı", "birim": "kg/adet/porsiyon/ay", "miktar": "sayı", "fiyat": "varsa"}],
  "iletisim": {"telefon": "", "email": "", "adres": "", "yetkili": ""},
  "notlar": ["KRİTİK not 1", "KRİTİK not 2"],
  "personel_detaylari": [{"pozisyon": "Aşçı", "adet": 6, "ucret_orani": "%85 fazlası"}],
  "ogun_bilgileri": [{"tur": "Normal Kahvaltı", "miktar": 805160, "birim": "öğün"}],
  "is_yerleri": ["Hastane adı 1", "Hastane adı 2"],
  "mali_kriterler": {"cari_oran": "0.75", "ozkaynak_orani": "0.15", "is_deneyimi": "%20", "ciro_orani": "%20"},
  "ceza_kosullari": [{"tur": "Genel aykırılık", "oran": "on binde 2", "aciklama": ""}],
  "fiyat_farki": {"formul": "Pn = (a1 × A1/Ao) + (b1 × B1/Bo) + ...", "katsayilar": {"a1": "0.17", "b1": "0.007", "b3": "0.813"}},
  "gerekli_belgeler": [{"belge": "TS 13075 Hizmet Yeri Yeterlilik Belgesi", "zorunlu": true, "puan": 0}],
  "teminat_oranlari": {"gecici": "%3", "kesin": "%6", "ek_kesin": "varsa"},
  "servis_saatleri": {"kahvalti": "06:00-07:00", "ogle": "12:00-14:00", "aksam": "17:00-19:00"},
  "sinir_deger_katsayisi": "0.79",
  "benzer_is_tanimi": "Kamu veya özel sektörde malzeme dahil yemek pişirme hizmeti"
}`;

/**
 * Sayfa analiz prompt'u (PDF görsel)
 */
export const PAGE_ANALYSIS_PROMPT = `Bu ihale şartnamesi sayfasını analiz et. 
            
Sayfadaki TÜM metni oku ve şu bilgileri çıkar:
- İhale başlığı
- Kurum/Kuruluş adı
- İhale tarihi ve saati
- Tahmini bedel
- İş süresi
- Teknik şartlar
- Birim fiyatlar (tablo varsa)
- İletişim bilgileri
- Önemli şartlar ve notlar

JSON formatında yanıt ver:
{
  "sayfa_metni": "Sayfadaki tüm metin...",
  "tespit_edilen_bilgiler": {
    "ihale_basligi": "",
    "kurum": "",
    "tarih": "",
    "bedel": "",
    "sure": "",
    "teknik_sartlar": [],
    "birim_fiyatlar": [],
    "iletisim": {},
    "notlar": []
  }
}`;

/**
 * Tablo analiz prompt'u (Excel)
 */
export const TABLE_ANALYSIS_PROMPT = `Bu Excel/tablo verilerini analiz et:

Özellikle şunları bul:
- Birim fiyatlar
- Miktarlar
- Toplam tutarlar
- Ürün/hizmet listesi

JSON formatında yanıt ver:
{
  "tam_metin": "Tablo özeti...",
  "ihale_basligi": "",
  "kurum": "",
  "tarih": "",
  "bedel": "",
  "sure": "",
  "teknik_sartlar": [],
  "birim_fiyatlar": [{"kalem": "", "birim": "", "miktar": "", "fiyat": ""}],
  "iletisim": {},
  "notlar": []
}`;

/**
 * Şehir normalize prompt'u
 */
export const CITY_NORMALIZE_PROMPT = `Bu metinden Türkiye şehir adını çıkar. Sadece şehir adını yaz, başka bir şey yazma.

Örnek çıktılar: İstanbul, Ankara, İzmir, Bursa`;

/**
 * Menü analizi prompt'u (PDF/görsel menülerden tarih ve yemek çıkarma)
 */
export const MENU_ANALYSIS_PROMPT = `Bu bir yemek menüsü dökümanıdır. Metinden tarihleri ve o tarihlere ait yemekleri çıkar.

ÇIKTI FORMATI (JSON array olarak döndür):
[
  {
    "tarih": "2026-01-15",
    "ogun": "kahvalti|ogle|aksam",
    "yemekler": ["Mercimek Çorbası", "Tavuk Sote", "Pilav", "Salata"]
  }
]

ÖNEMLİ KURALLAR:
- Tarihleri YYYY-MM-DD formatında yaz
- Öğün tipini içerikten tahmin et:
  * kahvalti: peynir, zeytin, yumurta, reçel, bal, simit, börek, poğaça
  * ogle/aksam: çorba, pilav, makarna, köfte, tavuk, et, balık, salata
- Sadece yemek isimlerini al, gramaj/kalori bilgilerini ALMA
- JSON formatında döndür, başka açıklama ekleme
- Eğer tarih bulunamazsa boş array döndür: []`;

/**
 * Menü prompt builder
 * @param {string} text - Menü metni
 * @returns {string}
 */
export function buildMenuAnalysisPrompt(text) {
  return `${MENU_ANALYSIS_PROMPT}

MENÜ METNİ:
${text.substring(0, 15000)}`;
}

/**
 * Text prompt builder
 * @param {string} text - Analiz edilecek metin
 * @returns {string}
 */
export function buildTextAnalysisPrompt(text) {
  return `${TENDER_ANALYSIS_PROMPT}

DÖKÜMAN:
${text.substring(0, 35000)}`;
}

/**
 * Table prompt builder
 * @param {string} csvText - CSV formatında tablo
 * @returns {string}
 */
export function buildTableAnalysisPrompt(csvText) {
  return `${TABLE_ANALYSIS_PROMPT}

${csvText.substring(0, 15000)}`;
}

/**
 * Boş analiz sonucu şablonu
 */
export const EMPTY_ANALYSIS_RESULT = {
  tam_metin: '',
  ihale_basligi: '',
  kurum: '',
  tarih: '',
  bedel: '',
  sure: '',
  ikn: '',
  gunluk_ogun_sayisi: '',
  kisi_sayisi: '',
  teknik_sartlar: [],
  birim_fiyatlar: [],
  iletisim: {},
  notlar: [],
  personel_detaylari: [],
  ogun_bilgileri: [],
  is_yerleri: [],
  mali_kriterler: {},
  ceza_kosullari: [],
  fiyat_farki: {},
  gerekli_belgeler: [],
  teminat_oranlari: {},
  servis_saatleri: {},
  sinir_deger_katsayisi: '',
  benzer_is_tanimi: '',
};

/**
 * Boş sayfa sonucu şablonu
 */
export const EMPTY_PAGE_RESULT = {
  sayfa_metni: '',
  tespit_edilen_bilgiler: {
    ihale_basligi: '',
    kurum: '',
    tarih: '',
    bedel: '',
    sure: '',
    ikn: '',
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: [],
    personel_detaylari: [],
    ogun_bilgileri: [],
    is_yerleri: [],
    mali_kriterler: {},
    ceza_kosullari: [],
    fiyat_farki: {},
    gerekli_belgeler: [],
    teminat_oranlari: {},
    servis_saatleri: {},
    sinir_deger_katsayisi: '',
    benzer_is_tanimi: '',
  },
};
