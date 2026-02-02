/**
 * AI Prompts - Tüm prompt şablonları
 */

/**
 * İhale dökümanı analiz prompt'u
 */
export const TENDER_ANALYSIS_PROMPT = `Sen bir YEMEK/CATERİNG ihale dökümanı analiz uzmanısın. Bu dökümanı DİKKATLİCE analiz et ve SOMUT bilgileri çıkar.

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
   - MENÜ TİPLERİ (kahvaltı, öğle, akşam, ara öğün)
   - GIDA GÜVENLİĞİ gereksinimleri (ISO, HACCP, sertifikalar)
   - KALORİ ihtiyaçları
   - TESLİMAT saatleri ve yerleri
   - CEZA ŞARTLARI (gecikme, eksik teslimat için TL cinsinden cezalar)
   - ZORUNLU BELGELER listesi

3. teknik_sartlar için: Yemek gramajları, porsiyon boyutları, malzeme kalitesi, saklama koşulları gibi SOMUT teknik detaylar
4. notlar için: Sadece İŞ İÇİN KRİTİK bilgiler (cezalar, zorunlu belgeler, özel koşullar)
5. birim_fiyatlar için: Her kalemi TAM olarak çıkar (kalem adı, birim, miktar)

JSON formatında yanıt ver:
{
  "tam_metin": "Kısa ve öz ihale özeti (max 500 karakter)",
  "ihale_basligi": "",
  "kurum": "",
  "tarih": "",
  "bedel": "",
  "sure": "",
  "gunluk_ogun_sayisi": "",
  "kisi_sayisi": "",
  "teknik_sartlar": ["SOMUT teknik şart 1", "SOMUT teknik şart 2"],
  "birim_fiyatlar": [{"kalem": "Ürün adı", "birim": "kg/adet/porsiyon", "miktar": "sayı", "fiyat": "varsa"}],
  "iletisim": {"telefon": "", "email": "", "adres": ""},
  "notlar": ["KRİTİK not 1 - örn: Gecikme cezası günlük %1", "KRİTİK not 2"]
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
  gunluk_ogun_sayisi: '',
  kisi_sayisi: '',
  teknik_sartlar: [],
  birim_fiyatlar: [],
  iletisim: {},
  notlar: [],
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
    teknik_sartlar: [],
    birim_fiyatlar: [],
    iletisim: {},
    notlar: [],
  },
};
