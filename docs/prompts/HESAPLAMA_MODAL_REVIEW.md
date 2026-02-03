# İhale Hesaplama Modalı - Gözden Geçirme Prompt'u

Bu prompt, `CalculationModal.tsx` bileşeninin kapsamlı incelemesi için kullanılacaktır.

---

## 🎯 İnceleme Kapsamı

### 1. Hesaplama Doğruluğu

**Kontrol Edilecekler:**
- [ ] Basit sınır değer formülü (×0.85) doğru mu?
- [ ] KİK sınır değer formülü doğru mu? (K katsayısı, standart sapma hesabı)
- [ ] Teminat oranları güncel mevzuata uygun mu? (%3 geçici, %6 kesin)
- [ ] Damga vergisi oranı güncel mi? (‰9.48)
- [ ] KİK payı oranı güncel mi? (‰0.5)
- [ ] Aşırı düşük kar marjı hesabı doğru mu?
- [ ] Öğün başı maliyet/teklif hesabı doğru mu?

**Araştırılacaklar:**
- 2024-2025-2026 yılı güncel KİK mevzuatı
- Damga vergisi güncel oranları
- Sınır değer hesaplama yönetmeliği

### 2. Tab'lar Arası Uyum

**Kontrol Edilecekler:**
- [ ] Temel Hesaplama'daki değerler diğer tab'lara doğru aktarılıyor mu?
- [ ] KİK sınır değer hesaplandığında basit sınır değeri override ediyor mu?
- [ ] Aşırı düşük analizinde doğru sınır değer kullanılıyor mu?
- [ ] Teminat hesabında bizim teklif doğru mu?
- [ ] Detaylı analiz kısmındaki değerler tüm tab'lardan güncel mi?

### 3. Manuel Giriş Kontrolleri

**Kontrol Edilecekler:**
- [ ] NumberInput'lar negatif değer kabul ediyor mu? (kabul etmemeli)
- [ ] Boş değer kontrolü yapılıyor mu?
- [ ] Thousand separator (.) ve decimal separator (,) doğru çalışıyor mu?
- [ ] Max değer limiti olmalı mı?
- [ ] Teklif listesinde min 3 zorunluluğu doğru işliyor mu?

### 4. Kaydetme & Veri Akışı

**Kontrol Edilecekler:**
- [ ] `hesaplama_verileri` JSONB'ye doğru kaydediliyor mu?
- [ ] Mevcut veriler korunuyor mu (merge)?
- [ ] Modal açıldığında eski veriler yükleniyor mu?
- [ ] `onRefresh` callback doğru çağrılıyor mu?

### 5. UI/UX İyileştirmeleri

**Düşünülecekler:**
- [ ] Mobil responsive gerekli mi?
- [ ] Loading state'leri yeterli mi?
- [ ] Error handling görsel olarak kullanıcıya gösteriliyor mu?
- [ ] Tooltip/bilgi ikonları eklenebilir mi?
- [ ] Tab değişiminde animasyon gerekli mi?

---

## 📝 Önerilen Değişiklikler (Şablon)

```
### [Kategori]
- **Sorun:** [Açıklama]
- **Çözüm:** [Önerilen çözüm]
- **Dosya:** [Etkilenen dosya]
```

---

## 🔗 İlgili Dosyalar

- `frontend/src/components/ihale-merkezi/CalculationModal.tsx` - Ana modal bileşeni
- `frontend/src/components/ihale-merkezi/CenterPanel/CenterPanel.tsx` - AraclarSection
- `frontend/src/lib/api/services/tenders.ts` - API çağrıları
- `backend/src/routes/tender-tracking.js` - Backend endpoint

---

## 📚 Referanslar

- KİK Sınır Değer Yönetmeliği
- 4734 Sayılı Kamu İhale Kanunu
- Damga Vergisi Kanunu güncel oranları
- İhale mevzuatı güncel değişiklikler

---

## 💬 Session Başlatma Prompt'u

```
CalculationModal.tsx bileşenini gözden geçirmemiz gerekiyor. 

Yapılacaklar:
1. Hesaplama formüllerinin doğruluğunu kontrol et (KİK sınır değer, teminat oranları, damga vergisi)
2. Tab'lar arası veri akışının tutarlılığını kontrol et
3. Manuel giriş validasyonlarını incele
4. Kaydetme ve veri yükleme akışını test et
5. Güncel mevzuatla karşılaştır (web araştırması yap)

docs/prompts/HESAPLAMA_MODAL_REVIEW.md dosyasındaki kontrol listesini takip et.
```
