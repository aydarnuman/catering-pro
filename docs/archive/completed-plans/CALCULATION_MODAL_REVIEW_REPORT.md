# CalculationModal.tsx İnceleme Raporu

**Tarih:** 3 Şubat 2026  
**İncelenen Dosya:** `frontend/src/components/ihale-merkezi/CalculationModal.tsx`

---

## 🔴 KRİTİK BULGULAR

### 1. KİK Sınır Değer Formülü YANLIŞ

**Mevcut Durum (Kod):**
```javascript
// K katsayıları
const kValues = { 3: 1.35, 4: 1.25, 5: 1.18, 6: 1.13, 7: 1.09, 8: 1.06 };
// Formül
const sinir = ortalama - k * stdSapma;
```

**Güncel KİK Mevzuatı:**
Personel çalıştırılmasına dayalı **olmayan** hizmet alımı ihaleleri için doğru formül:

```
SD = ((YM + ∑Tn) / (n+1)) × R
```

| Parametre | Açıklama |
|-----------|----------|
| SD | Sınır Değer |
| YM | Yaklaşık Maliyet (formüle dahil!) |
| ∑Tn | Geçerli tekliflerin toplamı |
| n | Geçerli teklif sayısı |
| R | KİK tarafından yıllık belirlenen katsayı |

**⚠️ ÖNEMLİ:** Koddaki K katsayıları (1.35, 1.25 vb.) istatistiksel standart sapma katsayılarıdır ve KİK'in resmi R katsayısı değildir!

**Yapım İşleri için N Katsayısı:**
| İş Grubu | N Katsayısı |
|----------|-------------|
| B-Üstyapı, C-Sıhhi Tesisat, D-Elektrik, E-Elektronik | 1,00 |
| A-Altyapı İşleri (Diğer) | 1,20 |

**Öneri:** İhale türüne göre (hizmet alımı / yapım işi) farklı formül seçimi yapılmalı ve güncel R katsayıları kullanılmalı.

---

## 🟢 DOĞRU OLAN ORANLAR

### 2. Teminat Oranları ✓
```javascript
const geciciTeminat = bizimTeklif * 0.03;  // %3 - DOĞRU
const kesinTeminat = bizimTeklif * 0.06;   // %6 - DOĞRU
```
4734 sayılı Kamu İhale Kanunu'na uygun.

### 3. Damga Vergisi ✓
```javascript
bizimTeklif * 0.00948  // ‰9.48 - DOĞRU
```
2025-2026 yılı ihale sözleşmeleri için güncel oran.

### 4. KİK Payı ✓
```javascript
bizimTeklif * 0.0005   // ‰0.5 (onbinde 5) - DOĞRU
```
Sözleşme bedelinin onbinde beşi oranı güncel.

---

## 🟡 TAB'LAR ARASI VERİ AKIŞI

### Tespit Edilen Sorunlar:

| Kontrol | Durum | Açıklama |
|---------|-------|----------|
| Temel → Diğer tab'lar | ✓ | `yaklasikMaliyet` ve `bizimTeklif` state'leri paylaşılıyor |
| KİK → Basit Sınır Değer | ✓ | `aktifSinirDeger = kikSinirDeger \|\| basitSinirDeger` |
| Aşırı Düşük → Sınır Değer | ✓ | `aktifSinirDeger` kullanılıyor |
| Teminat → Bizim Teklif | ✓ | `bizimTeklif` doğru aktarılıyor |

### Potansiyel İyileştirme:
- **Detaylı Analiz** bölümünde tüm tab'lardan veri gösteriliyor ancak `toplamMaliyet` (Aşırı Düşük tab'ından) dahil edilmemiş.

---

## 🟡 MANUEL GİRİŞ KONTROLLERI

### Tespit Edilen Eksiklikler:

| Kontrol | Durum | Öneri |
|---------|-------|-------|
| Negatif değer kontrolü | ⚠️ Yok | `min={0}` prop'u eklensin |
| Boş değer kontrolü | ✓ | `\|\| 0` ile handle ediliyor |
| Thousand/Decimal separator | ✓ | Doğru çalışıyor (`.` ve `,`) |
| Max değer limiti | ⚠️ Yok | Çok büyük değerler için `max` prop'u düşünülmeli |
| Min 3 teklif zorunluluğu | ✓ | `gecerliTeklifler.length < 3` kontrolü var |

**Kod Örneği - Önerilen Değişiklik:**
```javascript
<NumberInput
  label="Yaklaşık Maliyet"
  min={0}
  max={999999999999}  // 1 trilyon limit
  value={yaklasikMaliyet || ''}
  // ...
/>
```

---

## 🟡 KAYDETME & VERİ AKIŞI

### Backend Analizi (tender-tracking.js):

```javascript
// PUT /api/tender-tracking/:id
// Mevcut veriyle merge yapılıyor ✓
let mergedHesaplamaVerileri = null;
if (hesaplama_verileri) {
  const currentData = currentResult.rows[0]?.hesaplama_verileri || {};
  mergedHesaplamaVerileri = { ...currentData, ...hesaplama_verileri };
}
```

| Kontrol | Durum |
|---------|-------|
| JSONB kaydetme | ✓ Doğru |
| Mevcut veri koruma (merge) | ✓ Doğru |
| Modal açıldığında yükleme | ✓ `useEffect` ile yapılıyor |
| onRefresh callback | ✓ Doğru çağrılıyor |

---

## 📋 ÖNERİLEN DEĞİŞİKLİKLER

### Öncelik 1 - Kritik

#### 1.1 KİK Sınır Değer Formülünü Güncelle
```javascript
// Hizmet Alımı için doğru formül
const hesaplaKikSinirDeger = () => {
  const gecerliTeklifler = teklifListesi.filter(t => t.tutar > 0).map(t => t.tutar);
  
  if (gecerliTeklifler.length < 3) {
    // mevcut uyarı
    return;
  }

  const n = gecerliTeklifler.length;
  const toplam = gecerliTeklifler.reduce((a, b) => a + b, 0);
  
  // YENİ FORMÜL: SD = ((YM + ∑Tn) / (n+1)) × R
  // R katsayısı KİK tarafından yıllık belirlenir
  const R = 0.9; // TODO: Güncel R değeri API'den alınmalı
  const sinir = ((yaklasikMaliyet + toplam) / (n + 1)) * R;
  
  setKikSinirDeger(Math.round(sinir));
};
```

#### 1.2 İhale Türü Seçici Ekle
```javascript
const [ihaleTuru, setIhaleTuru] = useState<'hizmet' | 'yapim'>('hizmet');

// Yapım işleri için N katsayısı
const N_KATSAYISI = {
  'ustyapi': 1.00,  // B, C, D, E grupları
  'altyapi': 1.20,  // A grubu
};
```

### Öncelik 2 - Orta

#### 2.1 Input Validasyonları
```javascript
<NumberInput
  min={0}
  max={999999999999}
  error={yaklasikMaliyet < 0 ? 'Negatif değer girilemez' : null}
  // ...
/>
```

#### 2.2 Aşırı Düşük Tab'ına Kar Marjı Uyarısı
```javascript
{karMarji < 5 && karMarji >= 0 && (
  <Alert color="yellow">
    Kar marjı %5'in altında. Açıklama hazırlamanız gerekebilir.
  </Alert>
)}
```

### Öncelik 3 - Düşük

#### 3.1 R Katsayısı Bilgi Tooltip'i
```javascript
<Tooltip label="KİK tarafından her yıl 1 Şubat'ta güncellenir">
  <IconInfoCircle size={14} />
</Tooltip>
```

#### 3.2 Detaylı Analize Toplam Maliyet Ekle
```javascript
<Paper p="sm" bg="dark.7" radius="md" ta="center">
  <Text size="xs" c="dimmed">Toplam Maliyet</Text>
  <Text size="md" fw={700} c="yellow">
    {toplamMaliyet > 0 ? `${(toplamMaliyet / 1000000).toFixed(1)}M ₺` : '—'}
  </Text>
</Paper>
```

---

## 📚 KAYNAKLAR

- [EKAP Sınır Değer Hesaplama](https://ekap.kik.gov.tr/EKAP/Vatandas/SinirDegerHesaplama.aspx)
- [2026 Damga Vergisi Oranları](https://danisozcan.com/guncel-damga-vergisi-orani/)
- [KİK Eşik Değerler 2025-2026](https://www.hakedis.org/2025-yili-esik-degerleri-ve-parasal-limitleri-yayimlandi/)
- [Aşırı Düşük Sorgulama Rehberi](https://tekniksavunma.com/asiri-dusuk-sorgulama/)

---

## ✅ SONUÇ

| Kategori | Durum | Aksiyon |
|----------|-------|---------|
| Sınır Değer Formülü | 🔴 Kritik | Güncellenmeli |
| Teminat Oranları | 🟢 Doğru | - |
| Damga Vergisi | 🟢 Doğru | - |
| KİK Payı | 🟢 Doğru | - |
| Tab Veri Akışı | 🟢 Doğru | - |
| Input Validasyon | 🟡 Eksik | Min/Max ekle |
| Kaydetme/Yükleme | 🟢 Doğru | - |

**Toplam:** 1 kritik, 1 orta, birkaç düşük öncelikli düzeltme gerekli.
