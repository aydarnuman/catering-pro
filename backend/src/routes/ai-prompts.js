/**
 * AI Prompt Sabitleri
 * ai.js route dosyasından ayrıştırılmış prompt string'leri
 */

// ==========================================
// İHALE MASASI — Fallback Agent System Prompts
// ==========================================

export const IHALE_AGENT_SYSTEM_PROMPTS_FALLBACK = {
  mevzuat: `Sen bir kamu ihale mevzuatı uzmanısın. 4734 sayılı Kamu İhale Kanunu, 4735 sayılı Kamu İhale Sözleşmeleri Kanunu, KİK kararları ve Danıştay içtihatlarına hakimsin. Görevin ihale şartnamelerindeki hukuki riskleri tespit etmek ve teklif veren lehine öneriler sunmaktır. Türkçe yanıt ver.`,

  maliyet: `Sen bir catering maliyetlendirme uzmanısın. Yemek hizmet alımı ihalelerinde maliyet analizi, birim fiyat hesaplama, kâr marjı optimizasyonu konularında uzmansın. Mevcut piyasa fiyatları ve fatura verileriyle gerçekçi maliyet hesabı yaparsın. Türkçe yanıt ver.`,

  teknik: `Sen bir yemek hizmeti teknik şartname uzmanısın. Personel yeterliliği, ekipman gereksinimleri, menü planlaması, kapasite analizi konularında uzmansın. Şartnameyi teknik açıdan değerlendirip firmanın karşılayıp karşılayamayacağını analiz edersin. Türkçe yanıt ver.`,

  rekabet: `Sen bir ihale rekabet analisti ve istihbaratçısın. Rakip firma analizleri, geçmiş ihale sonuçları, teklif stratejileri konularında uzmansın. Piyasadaki rekabet durumunu değerlendirip optimal teklif stratejisi önerirsin. Türkçe yanıt ver.`,
};

// ==========================================
// İHALE MASASI — Malzeme Eşleştirme Prompt'u
// ==========================================

export const INGREDIENT_MATCH_PROMPT = `Sen bir catering/toplu yemek üretimi uzmanısın. Şartnamede geçen malzeme isimlerini, firmamızın ürün kataloğundaki doğru ürünle eşleştir.

## KURALLAR
1. Her şartname malzemesi için katalogdan EN UYGUN ürünü seç
2. Kısaltmaları çöz: "S.yağ" = Sıvı Yağ = Ayçiçek Yağı, "S.biber" = Sivri Biber, "Et" = Dana Kuşbaşı (catering bağlamında)
3. Genel isimler için en yaygın catering tercihini seç: "Yağ" = Ayçiçek Yağı, "Pirinç" = Pirinç (Baldo/Osmancık)
4. Hazır ürünler (Güllaç, Kadayıf, Helva, Kemalpaşa) katalogda yoksa "YOK" yaz
5. Emin olmadığında "YOK" yerine en yakın ürünü seç ve confidence düşük ver
6. SADECE verilen katalogdaki ürün ID'lerini kullan, uydurma

## ÇIKTI FORMATI (sadece JSON, açıklama yok)
[
  {"sartname": "Et", "urun_id": 4729, "urun_ad": "Dana Kuşbaşı", "confidence": 0.95, "not": "Catering'de 'et' genelde dana kuşbaşı"},
  {"sartname": "Güllaç", "urun_id": null, "urun_ad": null, "confidence": 0, "not": "Hazır ürün, katalogda yok"}
]`;

// ==========================================
// KART DÖNÜŞTÜRME PROMPT'LARI
// ==========================================

export const CARD_TRANSFORM_PROMPTS = {
  table: `Aşağıdaki metni bir tabloya dönüştür. JSON formatında döndür:
{
  "card_type": "table",
  "title": "Kısa açıklayıcı başlık",
  "content": { "headers": ["Sütun1", "Sütun2", ...], "rows": [["değer1", "değer2", ...], ...] },
  "category": "operasyonel|mali|teknik|belgeler|diger"
}
Sadece JSON döndür, başka bir şey yazma.`,

  summary: `Aşağıdaki metni kısa ve öz bir şekilde özetle. JSON formatında döndür:
{
  "card_type": "text",
  "title": "Kısa başlık (max 80 karakter)",
  "content": { "text": "Özet metin" },
  "category": "operasyonel|mali|teknik|belgeler|diger"
}
Sadece JSON döndür, başka bir şey yazma.`,

  extract: `Aşağıdaki metinden yapısal verileri çıkar (tarih, tutar, oran, miktar, süre vb.). Birden fazla veri varsa list formatı, tek veri varsa number formatı kullan. JSON formatında döndür:

Tek veri için:
{
  "card_type": "number",
  "title": "Veri açıklaması",
  "content": { "label": "Etiket", "value": 123, "unit": "birim" },
  "category": "operasyonel|mali|teknik|belgeler|diger"
}

Birden fazla veri için:
{
  "card_type": "list",
  "title": "Çıkarılan veriler",
  "content": { "items": ["Veri 1: değer", "Veri 2: değer", ...] },
  "category": "operasyonel|mali|teknik|belgeler|diger"
}
Sadece JSON döndür, başka bir şey yazma.`,

  // ─── Yeni Transform Tipleri (AnalysisDetailModal) ───────────
  summarize: `Aşağıdaki ihale dokümanı içeriğini 2-3 cümle ile özetle. Türkçe yaz.
Kritik sayısal verileri (kişi sayısı, tutar, süre) mutlaka dahil et.
Özeti markdown formatında yaz (kalın metin, madde işaretleri kullanabilirsin).
JSON formatında döndür:
{
  "title": "İçerik Özeti",
  "content": "2-3 cümlelik özet metni (markdown)"
}
Sadece JSON döndür.`,

  reformat: `Aşağıdaki metni daha okunabilir bir formata yeniden düzenle.
- Yapısal veriler varsa grupla
- Sayısal değerleri vurgula
- Önemli kısımları ayrı maddeler halinde listele
Türkçe yaz. JSON formatında döndür:
{
  "card_type": "text",
  "title": "Yeniden Formatlanmış İçerik",
  "content": "Formatlanmış metin"
}
Sadece JSON döndür.`,

  to_list: `Aşağıdaki metin/paragrafı maddeli listeye dönüştür.
Her madde ayrı bir satırda, kısa ve net olsun.
Türkçe yaz. JSON formatında döndür:
{
  "card_type": "list",
  "title": "Maddeler",
  "content": { "items": ["Madde 1", "Madde 2", "Madde 3", ...] }
}
Sadece JSON döndür.`,

  to_table: `Aşağıdaki metni/listeyi tabloya dönüştür. Uygun sütun başlıkları belirle.
Türkçe yaz. JSON formatında döndür:
{
  "card_type": "table",
  "title": "Tablo",
  "content": { "headers": ["Sütun1", "Sütun2", ...], "rows": [["değer1", "değer2", ...], ...] }
}
Sadece JSON döndür.`,

  validate: `Aşağıdaki ihale dokümanı verisini analiz et ve olası tutarsızlıkları, eksiklikleri ve hataları tespit et.
- Sayısal tutarsızlıklar (toplam uyuşmazlığı vb.)
- Mantıksal çelişkiler
- Eksik veya şüpheli bilgiler
- Olası yazım/veri hataları
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Doğrulama Raporu",
  "content": "Markdown formatında bulgular ve öneriler"
}
Sadece JSON döndür.`,

  // ─── Kart-Spesifik Transform Tipleri ──────────────────────────

  find_duplicates: `Aşağıdaki ihale dokümanı maddelerini incele ve benzer/tekrar eden içerikleri tespit et.
- Aynı konuyu farklı ifadelerle anlatan maddeler
- Birbiriyle çelişen maddeler
- Gereksiz tekrarlar
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Benzerlik Analizi",
  "content": "Markdown formatında benzerlik raporu"
}
Sadece JSON döndür.`,

  extract_risks: `Aşağıdaki ihale dokümanı içeriğinden risk, uyarı ve kısıtlama maddelerini çıkar.
Her risk için:
- Risk açıklaması
- Olası etki (düşük/orta/yüksek)
- Öneri
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Risk Analizi",
  "content": "Markdown formatında risk raporu",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,

  find_gaps: `Aşağıdaki teknik şartname içeriğini incele ve potansiyel eksikleri tespit et.
Kontrol edilecekler:
- Belirsiz veya muğlak ifadeler
- Eksik teknik detaylar (ölçü, standart, tolerans vb.)
- Referans verilmemiş standartlar
- Tanımlanmamış test/kabul kriterleri
- Eksik süre/miktar/kapasite bilgileri
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Eksik Gereksinim Raporu",
  "content": "Markdown formatında eksiklik raporu",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,

  price_check: `Aşağıdaki birim fiyat verilerini analiz et.
- Her kalemin birim fiyatının makul olup olmadığını değerlendir
- Aşırı düşük veya yüksek fiyatları işaretle
- Genel bilgi olarak Türkiye kamu ihale piyasası birim fiyatlarıyla karşılaştır
- Toplam tutarın tutarlılığını kontrol et
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Fiyat Analizi",
  "content": "Markdown formatında fiyat raporu",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,

  regulation_check: `Aşağıdaki ihale verilerini 4734 sayılı Kamu İhale Kanunu ve ilgili mevzuat çerçevesinde değerlendir.
Kontrol edilecekler:
- Teminat oranlarının yasal sınırlara uygunluğu (geçici teminat %3, kesin teminat %6)
- Mali yeterlilik kriterlerinin KİK mevzuatına uygunluğu
- İş deneyim belgesi oranlarının yasal aralıkta olup olmadığı
- Bilanço kriterlerinin uygunluğu
- Aşırı kısıtlayıcı şartlar olup olmadığı
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Mevzuat Uygunluk Raporu",
  "content": "Markdown formatında mevzuat raporu",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,

  penalty_analysis: `Aşağıdaki ceza koşullarını analiz et.
Kontrol edilecekler:
- Ceza oranlarının makul olup olmadığı
- Sözleşme bedeliyle orantılılık
- Kamu İhale Sözleşmeleri Kanunu çerçevesinde yasal sınırlar
- Kümülatif ceza üst limiti
- Belirsiz veya ölçülemeyen ceza kriterleri
- Tek taraflı fesih riski oluşturan maddeler
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "Ceza Riski Raporu",
  "content": "Markdown formatında ceza analizi",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,

  labor_cost_check: `Aşağıdaki personel verilerini analiz et.
Kontrol edilecekler:
- Personel sayısının hizmet kapsamıyla orantılılığı
- Pozisyon bazlı ücret seviyelerinin güncel asgari ücret ve sektör ortalamasıyla karşılaştırması
- Vardiya düzeninin yasal çalışma sürelerine uygunluğu
- Toplam işçilik maliyeti tahmini
- SGK ve diğer yasal yükümlülükler dahil maliyet
- Fazla mesai ve resmi tatil maliyeti riskleri
Türkçe yaz. Markdown formatında yaz (başlıklar, madde işaretleri, kalın metin).
JSON formatında döndür:
{
  "title": "İşçilik Maliyet Raporu",
  "content": "Markdown formatında maliyet analizi",
  "risk_level": "low|medium|high"
}
Sadece JSON döndür.`,
};

// ==========================================
// ÇAPRAZ ANALİZ PROMPT'U
// ==========================================

export const CROSS_ANALYSIS_SYSTEM_PROMPT = `Sen bir ihale analiz uzmanısın. Verilen ihale analiz verilerini çapraz kontrol edeceksin.

GÖREV:
1. Farklı kategorilerdeki verilerin tutarlılığını kontrol et
2. Eksik veya çelişkili bilgileri tespit et
3. Kritik uyarıları belirle
4. Öneriler sun

ÇIKTI FORMATI (Türkçe):
## 🔍 Çapraz Analiz Sonuçları

### ✅ Tutarlı Veriler
- [Tutarlı bulunan önemli veriler]

### ⚠️ Uyarılar
- [Dikkat edilmesi gereken noktalar]

### ❌ Eksik/Çelişkili Bilgiler
- [Tespit edilen sorunlar]

### 💡 Öneriler
- [Teklif hazırlarken dikkat edilmesi gerekenler]

Kısa ve öz ol. Sadece önemli bulgulara odaklan.`;
