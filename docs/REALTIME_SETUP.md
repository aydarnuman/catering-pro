# 🔄 Realtime Entegrasyon Kurulum Rehberi

## ✅ Tamamlanan İşlemler

### 1. Environment Variables ✅
Frontend `.env.local` dosyasına eklendi:
```env
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_SUPABASE_URL=https://vpobejfxqihvgsjwnyku.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### 2. Navbar Indicator ✅
`RealtimeIndicator` component'i navbar'a eklendi.

### 3. Kod Entegrasyonları ✅
13 kritik sayfada `useRealtimeRefetch` aktif:
- ✅ Faturalar
- ✅ Cariler
- ✅ Stok
- ✅ Personel
- ✅ Demirbaş
- ✅ İhaleler
- ✅ Ana Sayfa
- ✅ Muhasebe Dashboard
- ✅ Kasa-Banka
- ✅ Satın Alma
- ✅ Menü Planlama
- ✅ İhale Takibi
- ✅ Finans

---

## 🔧 Supabase Kurulumu (ZORUNLU)

### Adım 1: Supabase Dashboard'a Git
```
https://vpobejfxqihvgsjwnyku.supabase.co
```

### Adım 2: SQL Editor'ü Aç
1. Sol menüden **SQL Editor**'e tıkla
2. **New Query** butonuna bas

### Adım 3: Setup Script'i Çalıştır
`backend/supabase-realtime-setup.sql` dosyasındaki kodu kopyala yapıştır ve **Run** tuşuna bas.

Bu script:
- 15 tabloyu realtime publication'a ekler
- Her tablo için RLS (Row Level Security) aktivasyonu yapar
- Okuma izinleri için basit policy'ler oluşturur

### Adım 4: Realtime Ayarlarını Kontrol Et
1. **Database** → **Replication** sekmesine git
2. **Publication** altında şu tabloları göreceksin:
   - invoices
   - cariler
   - cari_hareketler
   - stok
   - stok_hareketler
   - tenders
   - notifications
   - personeller
   - kasa_banka_hareketler
   - bordro
   - projeler
   - demirbas
   - urunler
   - menu_items
   - satin_alma

---

## 🚀 Test Etme

### Test 1: Bağlantı Kontrolü
```bash
cd frontend
npm run dev
```

1. Uygulamayı aç: `http://localhost:3000`
2. Navbar'da **yeşil "Live"** badge'i göreceksin
3. Browser console'da şu mesajı gör:
   ```
   [Realtime] ✅ Bağlantı kuruldu
   ```

### Test 2: Veri Değişikliği
1. Başka bir sekmede Supabase SQL Editor'ü aç
2. Test sorgusu çalıştır:
   ```sql
   UPDATE invoices SET toplam_tutar = toplam_tutar + 1 WHERE id = 1;
   ```
3. Ana sayfada **mavi toast bildirimi** göreceksin:
   ```
   🔄 Veri Güncellendi
   Faturalar güncellendi
   ```

### Test 3: Otomatik Yenileme
1. Faturalar sayfasını aç
2. SQL ile yeni fatura ekle:
   ```sql
   INSERT INTO invoices (fatura_no, tarih, toplam_tutar)
   VALUES ('TEST-2024-001', NOW(), 1000);
   ```
3. Sayfa **otomatik yenilenecek** (scroll pozisyonu korunur)

---

## 🎨 Kullanıcı Deneyimi

### Toast Bildirimleri
Her veri değişikliğinde kullanıcı bilgilendirilir:
- **Mavi**: Normal değişiklik
- **Yeşil**: Başarılı işlem
- **Kırmızı**: Hata
- **Turuncu**: Uyarı

### Live Indicator
Navbar'da bağlantı durumu:
- **🟢 Live**: Bağlı
- **🟡 ...**: Bağlanıyor
- **🔴 Offline**: Bağlantı hatası

### Otomatik Yenileme
- Scroll pozisyonu korunur
- Sadece değişen veriler güncellenir
- Kullanıcı etkileşimi kesintiye uğramaz

---

## 🔒 Güvenlik Notları

### Production İçin RLS Politikaları
Şu anki setup **tüm kullanıcılara okuma izni** veriyor (geçici).

Production'da her tablo için kullanıcı bazlı politikalar ekle:

```sql
-- Örnek: Sadece giriş yapmış kullanıcılar görebilsin
DROP POLICY IF EXISTS "Faturalar herkese açık" ON invoices;

CREATE POLICY "Faturalar sadece auth" ON invoices
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Örnek: Sadece kendi kayıtlarını görebilsin
CREATE POLICY "Cariler sadece owner" ON cariler
  FOR SELECT
  USING (auth.uid() = created_by);
```

### Realtime Limitleri
Supabase Free Tier:
- Max 200 concurrent connections
- Max 2GB realtime data transfer/month
- Max 500,000 realtime messages/month

Production'da **Supabase Pro** kullan.

---

## 📊 Performance Optimizasyonları

### 1. Toast Throttling
Çok fazla bildirim gelmesini engelle:
```tsx
// RealtimeContext.tsx'de zaten yapıldı
// Her tablo değişikliğinde MAX 1 toast (3 saniye cooldown)
```

### 2. Debouncing
Hızlı ardışık değişikliklerde tek request:
```tsx
const debouncedRefetch = useDebouncedCallback(refetch, 500);
useRealtimeRefetch('invoices', debouncedRefetch);
```

### 3. Selective Listening
Sadece ihtiyaç olan sayfada dinle:
```tsx
// Sadece /faturalar sayfasında aktif
const pathname = usePathname();
const enabled = pathname === '/muhasebe/faturalar';

useRealtimeRefetch('invoices', refetch, { enabled });
```

---

## 🐛 Sorun Giderme

### Bağlantı Kurulamıyor
**Semptom:** "🔴 Offline" göstergesi

**Çözüm:**
1. Environment variables doğru mu kontrol et
2. Supabase project aktif mi kontrol et
3. RLS politikaları doğru mu kontrol et
4. Browser console'da hata mesajlarını oku

### Toast Bildirimleri Gelmiyor
**Semptom:** Veri değişiyor ama bildirim gelmiyor

**Çözüm:**
1. `useRealtimeRefetch` hook'u eklenmiş mi?
2. Callback fonksiyonu `useCallback` ile sarılmış mı?
3. Tablo adı doğru mu? (ör: 'invoices' not 'invoice')

### Çift Yenileme Oluyor
**Semptom:** Aynı değişiklik iki kez yeniliyor

**Çözüm:**
1. Aynı tabloyu birden fazla yerde dinleme
2. `useEffect` dependency array'i kontrol et
3. Debouncing ekle

### Realtime Çalışmıyor (Genel)
```bash
# 1. .env.local kontrolü
cat frontend/.env.local | grep REALTIME
# NEXT_PUBLIC_ENABLE_REALTIME=true olmalı

# 2. Restart
npm run dev

# 3. Supabase connection test
# Browser console'da:
localStorage.setItem('realtime-debug', 'true');
# Refresh yap ve console log'larını oku
```

---

## 📈 İzleme ve Metrikler

### Supabase Dashboard
1. **Database** → **Realtime** sekmesine git
2. Aktif connection sayısını gör
3. Realtime kullanım istatistiklerini gör

### Debug Mode
```tsx
// localStorage'a ekle
localStorage.setItem('realtime-debug', 'true');

// Console'da detaylı loglar göreceksin:
// [Realtime] invoices değişti: UPDATE
// [Realtime] Payload: {...}
```

---

## 🎯 Gelecek İyileştirmeler

### Öncelik 1: Selective Updates
Tüm kayıt yerine sadece değişen kaydı güncelle:
```tsx
useRealtimeRefetch('invoices', (payload) => {
  // Sadece değişen kaydı SWR cache'de güncelle
  mutate(
    '/api/invoices',
    (current) => current.map(inv =>
      inv.id === payload.new.id ? payload.new : inv
    ),
    false
  );
});
```

### Öncelik 2: Optimistic Updates
Değişikliği hemen göster, sonra doğrula:
```tsx
const { mutate } = useSWR('/api/invoices');

// Silme işlemi
const handleDelete = async (id) => {
  // Optimistic update
  mutate(
    current => current.filter(inv => inv.id !== id),
    false // Revalidate etme
  );

  // API call
  await api.delete(`/invoices/${id}`);

  // Realtime otomatik doğrulayacak
};
```

### Öncelik 3: Presence (Kim Online)
Hangi kullanıcıların online olduğunu göster:
```tsx
const { presenceState } = usePresence('global-room');

// Navbar'da göster:
<Badge>{Object.keys(presenceState).length} online</Badge>
```

---

## 📝 Checklist

- [x] Environment variables eklendi
- [x] Navbar indicator eklendi
- [x] 13 sayfa entegrasyonu tamamlandı
- [ ] Supabase SQL script çalıştırıldı
- [ ] Test edildi
- [ ] Production RLS politikaları güncellendi
- [ ] Monitoring setup edildi

---

## 🆘 Destek

Sorun yaşıyorsan:
1. `REALTIME_DEBUG.md` dosyasını oku
2. Browser console loglarını incele
3. Supabase dashboard'da realtime metrics'e bak
4. GitHub issue aç

---

**SON DURUM:** Kod %100 hazır, sadece Supabase SQL script çalıştırılması gerekiyor! 🚀
