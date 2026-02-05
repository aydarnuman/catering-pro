# İHALE ŞARTNAMESİ ANALİZ PIPELINE'I
## Zero-Loss Mimari İncelemesi ve Uygulama Kontrol Listesi

---

# BÖLÜM 1: VERİ KAYBI RİSK ANALİZİ

## 1.1 Chunking Aşamasında Kaybolabilecek Bilgiler

### Tablo Bölünme Riskleri
- Çok sütunlu tablolarda satır-sütun ilişkisi kopabilir. Örnek: "Kahvaltı menüsü" başlığı bir chunk'ta, kalori değerleri sonraki chunk'ta kalırsa, LLM "bu değerler neye ait?" sorusunu cevaplayamaz.
- Tablo dipnotları genellikle tablonun altında yer alır. Chunk sınırı tam tablonun bitiminde kesilirse, "(*) KDV hariç fiyatlardır" gibi kritik dipnotlar kaybolur.
- Merged cell'ler (birleştirilmiş hücreler) OCR'da düz metin olarak gelir. Chunk bölünmesi bu yapıyı tamamen bozar.

### Başlık-İçerik Ayrışması
- "Madde 12.3.4 – Ceza Koşulları" başlığı bir chunk'ın sonunda kalırsa, ceza oranları sonraki chunk'ta bağlamsız kalır.
- Alt başlıklar üst başlıklardan koptuğunda hiyerarşi kaybolur. "12.3 Genel Hükümler → 12.3.4 Cezalar" zinciri kırılır.

### Sayısal Değer Riskleri
- Tarih aralıkları: "01.06.2025 – 31.08.2025" chunk ortasından bölünebilir.
- Para birimleri: "1.250.000,00 TL + KDV" ifadesinde TL bir chunk'ta, KDV bilgisi diğerinde kalabilir.
- Yüzdelik oranlar: "%2,5 gecikme cezası, günlük" ifadesinde "günlük" kelimesi kopabilir (bu kritik bir fark yaratır).

### Somut Kayıp Senaryoları

| Senaryo | Kayıp Türü | Sonuç |
|---------|-----------|-------|
| "Porsiyon gramajı: et 150g, tavuk 120g" bölündü | Kısmi veri | LLM sadece "et 150g" görür, tavuk gramajı kayıp |
| Ceza tablosu 2 chunk'a dağıldı | Bağlam kaybı | %2 ceza hangi ihlal için belirsiz |
| "Madde 7.2'ye bakınız" referansı izole | Çözülemeyen referans | LLM hallucinate eder veya boş bırakır |
| Dipnot ana metinden koptu | Kritik koşul kaybı | "Fiyatlar 2025 yılı için geçerlidir" bilgisi yok |

---

# BÖLÜM 2: LLM YÖNLENDİRME HATALARI

## 2.1 Chunker'ın Gizli Yönlendirmeleri
- **Meta-sinyal Problemleri:** Chunk'a "BU BİR TABLO CHUNK'IDIR" etiketi eklendiğinde, LLM gerçekten tablo olmayan yapılandırılmış metni de tablo olarak işlemeye zorlanır.
- **Bağlam Sızdırma:** "total_chunks: 47, current: 23" bilgisi LLM'e "ortadayım, önemli bilgi muhtemelen başta veya sondadır" şeklinde implicit bias verir.

## 2.2 Hallucination Risk Faktörleri
- **Completion Bias:** LLM eksik bilgiyi tamamlama eğilimindedir. "Porsiyon: 150..." gördüğünde "150 gram" diye tamamlar – oysa "150 ml" veya "150 adet" olabilir.
- **Tarih Tamamlama:** Tarih formatı eksikse (sadece "15 Haziran" yazıyorsa) LLM yıl ekler – bu ihale bağlamında kritik hata.

## 2.3 Tehlikeli Varsayımlar
- "LLM tablo yapısını doğru anlayacaktır" → HAYIR. OCR'dan gelen düz metinde sütun sınırları belirsizdir.
- "LLM eksik bilgiyi boş bırakacaktır" → HAYIR. Özellikle küçük modeller tamamlama eğilimindedir.
- "LLM çelişkili bilgiyi işaretleyecektir" → NADİREN. Genellikle son gördüğü bilgiyi tercih eder.

---

# BÖLÜM 3: ZERO-LOSS PIPELINE MİMARİSİ

## 3.1 Önerilen 7 Aşamalı Yapı

| Aşama | İsim | Zeka Seviyesi | Sorumluluk |
|-------|------|---------------|------------|
| 0 | Raw Capture | Dumb | OCR çıktısını hiç değiştirmeden sakla |
| 1 | Structure Detection | Rule-based | Regex/heuristic ile tablo, başlık, liste tespiti |
| 2 | Semantic Chunking | Hybrid | Anlam bütünlüğünü koruyarak bölme |
| 3 | Field Extraction | LLM (Narrow) | Tek alan türü için extraction |
| 4 | Cross-Reference | Rule-based | Chunk'lar arası referans çözümleme |
| 5 | Conflict Detection | LLM (Narrow) | Çelişki tespiti (çözüm değil) |
| 6 | Assembly | Dumb | Tüm extraction'ları birleştir |
| 7 | Validation | Rule-based | Şema uyumu, completeness kontrolü |

## 3.2 LLM Karar Vermemesi Gereken Katmanlar

| Katman | LLM Karar Verebilir mi? | Neden? |
|--------|------------------------|--------|
| Layer 0, 6, 7 | **HAYIR** | Veri bütünlüğü mutlak, assembly ve validation deterministik olmalı |
| Layer 1 | **HAYIR** | Yapısal tespit deterministik olmalı |
| Layer 2, 4 | Kısmen | Rule-based ana süreç, LLM sadece doğrulama/belirsiz durumlar |
| Layer 3 | Evet (dar scope) | Extraction LLM'in güçlü olduğu alan |
| Layer 5 | Sadece tespit | Conflict detection OK, resolution HAYIR |

---

# BÖLÜM 4: UYGULAMA KONTROL LİSTESİ

## P0 – YAPILMAZSA VERİ KAYBI KESİN

### P0-01: Tablo Bölünme Kontrolü
**Neyi garanti altına almalı:** Hiçbir tablo iki veya daha fazla chunk'a bölünmemiş olmalı.

**Risk:** Tablo satır-sütun ilişkisi kopar. LLM hangi değerin neye ait olduğunu bilemez.

### P0-02: Tablo Dipnotu Bağlantısı
**Neyi garanti altına almalı:** Tablo dipnotları tablonun bulunduğu chunk ile aynı chunk'ta olmalı.

**Risk:** Kritik koşul bilgisi kaybolur. Fiyat tablosu KDV dahil mi hariç mi belirsiz kalır.

### P0-03: Başlık-İçerik Birlikteliği
**Neyi garanti altına almalı:** Madde başlığı ve içeriği aynı chunk'ta olmalı.

**Risk:** Ceza oranları hangi maddeye ait olduğu belirsiz kalır.

### P0-04: Sayısal Değer Bütünlüğü
**Neyi garanti altına almalı:** Para tutarları, yüzde ve tarih aralıkları chunk ortasından bölünmemiş olmalı.

**Risk:** "%2,5" görülür ama "günlük" kelimesi kaybolur – aylık mı günlük mü ceza belirsiz kalır.

### P0-05: Karakter Kaybı Kontrolü
**Neyi garanti altına almalı:** OCR çıktısı ile tüm chunk'ların toplam karakter sayısı eşit olmalı.

**Risk:** Chunking sırasında karakter düşer. Kritik bir rakam veya tarih sessizce yok olur.

### P0-06: JSON Parse Başarı Garantisi
**Neyi garanti altına almalı:** Her LLM çıktısı geçerli JSON olmalı. Parse başarısız olduğunda raw output saklanmalı.

**Risk:** Parse hatası sonucu tüm chunk analizi kaybolur. O chunk'lardaki tüm bilgi yok sayılır.

### P0-07: Boş Array vs Null Ayrımı
**Neyi garanti altına almalı:** "penalties": [] (gerçekten ceza yok) ile "penalties": null (LLM bulamadı) ayrımı yapılmalı.

**Risk:** LLM cezayı bulamadığında boş array döner, sistem "ceza yok" olarak yorumlar.

### P0-08: Stage 2 Yeni Bilgi Ekleme Yasağı
**Neyi garanti altına almalı:** Stage 2 çıktısında, Stage 1 çıktılarının hiçbirinde bulunmayan bilgi olmamalı.

**Risk:** Stage 2 LLM'i "mantıklı" gördüğü bilgiyi ekler. Kullanıcı bunu gerçek veri sanır.

### P0-09: Conflict Preservation (Çelişki Koruma)
**Neyi garanti altına almalı:** Aynı alan için farklı değerler tespit edildiğinde her iki değer de final JSON'da saklanmalı.

**Risk:** Stage 2 birini seçer, diğerini siler. Seçilen değer yanlış olabilir.

### P0-10: Source Traceability (Kaynak İzlenebilirliği)
**Neyi garanti altına almalı:** Final JSON'daki her değer için kaynak chunk ID'si mevcut olmalı.

**Risk:** Bir değerin doğruluğu sorgulandığında orijinal metne dönülemez. Audit yapılamaz.

---

## P1 – YAPILMAZSA KALİTE DÜŞER

### P1-01: Referans Çözümleme Oranı Takibi
**Neyi garanti altına almalı:** "Madde 8'de belirtilen koşullar" gibi referansların çözümleme oranı ölçülmeli.

**Risk:** LLM referansı çözemeyince ya boş bırakır ya hallucinate eder.

### P1-02: Hallucination Test Mekanizması
**Neyi garanti altına almalı:** Bilinen bir doküman için LLM çıktısı manuel olarak doğrulanmış olmalı.

**Risk:** LLM eksik bilgiyi "tamamlar". Yanlış birim kritik hesaplama hatası yaratır.

### P1-03: Confidence Threshold Uygulaması
**Neyi garanti altına almalı:** Düşük confidence (<0.7) extraction'lar ayrı raporlanmalı.

**Risk:** Güvensiz extraction'lar kesin bilgi gibi sunulur.

### P1-04: Cross-Chunk Leakage Kontrolü
**Neyi garanti altına almalı:** LLM bir chunk'ı işlerken önceki chunk'lardan bilgi taşımamalı.

**Risk:** Chunk 15'teki bilgi Chunk 16'ya sızar. Yanlış eşleştirme oluşur.

### P1-05: Merge Determinism Testi
**Neyi garanti altına almalı:** Aynı input ile sistem iki kez çalıştırıldığında aynı output üretmeli.

**Risk:** Her çalıştırmada farklı sonuç çıkar. Test ve debug imkansızlaşır.

### P1-06 – P1-10: Prompt Kalite Kontrolleri
- **Stage 1 Prompt Scope:** Tek seferde çok fazla alan türü istememeli.
- **JSON Şema Genişliği:** Chunk-level şema minimal olmalı.
- **Pozitif Talimat:** "Tahmin etme" yerine "sadece metinde açıkça yazını raporla" kullanılmalı.
- **Meta-Sinyal Doğruluğu:** "chunk_type: table" etiketi gerçeği yansıtmalı.
- **Stage 2 Ayrımı:** "Birleştir" demeli, "analiz et ve sentezle" DEMEMELİ.

---

## P2 – OPSİYONEL AMA FAYDALI

| Kod | Kontrol | Risk |
|-----|---------|------|
| P2-01 | Alt başlık hiyerarşisi koruma | Kategorileme hatalı olur |
| P2-02 | Küçük chunk birleştirme güvenliği | Yapay anlam oluşur |
| P2-03 | Numaralı liste bütünlüğü | Liste yapısı bozulur |
| P2-04 | Tarih formatı eksikliği tespiti | LLM yıl tahmin eder |
| P2-05 | Edge case davranış tanımı | Beklenmedik input'ta sistem çöker |
| P2-06 | Schema evolution uyumu | Geriye dönük uyumluluk kaybolur |
| P2-07 | Nested structure derinlik limiti | Parser sorunları |
| P2-08 | Audit trail bütünlüğü | Hata kaynağı tespit edilemez |
| P2-09 | Completion bias sample check | Veri kaybı fark edilmez |
| P2-10 | "Önemli" tanımı kaldırma | LLM kritik maddeyi atlar |

---

# BÖLÜM 5: ÖZET VE ÖNERİLER

## Öncelik Dağılımı

| Öncelik | Kontrol Sayısı | Odak |
|---------|---------------|------|
| **P0** | 10 | Veri kaybı önleme, bütünlük |
| **P1** | 10 | Kalite, güvenilirlik, tutarlılık |
| **P2** | 10 | Optimizasyon, bakım kolaylığı |

## Acil Öncelikli Aksiyonlar (P0)
- **Tablo koruma mekanizması:** Chunking aşamasında tablo tespiti yapılmalı ve tablo asla bölünmemeli.
- **Micro-extraction geçişi:** Tek büyük prompt yerine alan-spesifik küçük prompt'lar.
- **Conflict preservation zorunluluğu:** Stage 2 asla değer seçmemeli.

## Kullanım Önerisi
Mevcut kodu bu listeyle tarayın. **P0'ların tamamı geçmeden production'a çıkmayın.** P1'lerin en az %80'i karşılanmalı. P2'ler backlog'a alınabilir.
