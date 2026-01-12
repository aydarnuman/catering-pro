# Cursor AI Prompt Şablonları

Bu dosya, Cursor AI'a görev verirken kullanılacak standart prompt şablonlarını içerir.

---

## 📋 GÖREV VERİRKEN KULLANILACAK ŞABLONLAR

---

### 1️⃣ YENİ ÖZELLİK EKLEMEk

```
## Görev: [Özellik Adı]

### Bağlam
Bu proje hazır yemek sektörü için ERP-benzeri bir yönetim sistemidir.
Mevcut modüller: İhale takip, Muhasebe, Stok, Personel/Bordro, Menü Planlama

### İstenen Özellik
[Özelliğin detaylı açıklaması]

### Teknik Gereksinimler
- Backend: Node.js + Express (CommonJS)
- Frontend: Next.js 14 App Router
- Database: PostgreSQL (Supabase)
- API format: { success: true/false, data/error }

### Dosya Konumları
- Backend routes: /backend/src/routes/
- Backend services: /backend/src/services/
- Frontend pages: /frontend/src/app/
- Migrations: /backend/src/migrations/

### Beklenen Çıktı
1. [ ] Database migration dosyası (varsa)
2. [ ] Backend route/service
3. [ ] Frontend page/component
4. [ ] Hata yönetimi

### Kısıtlamalar
- Mevcut yapıyı bozmadan ekle
- SQL injection koruması (parameterized queries)
- Türkçe karakter desteği
```

---

### 2️⃣ BUG DÜZELTMEk

```
## Görev: Bug Düzeltme

### Sorun
[Hatanın detaylı açıklaması]

### Beklenen Davranış
[Nasıl çalışması gerektiği]

### Mevcut Davranış
[Şu an nasıl çalıştığı]

### Hata Mesajı/Log
```
[Varsa hata mesajını yapıştır]
```

### İlgili Dosyalar
- [dosya yolu 1]
- [dosya yolu 2]

### Öncelik
[ ] Kritik - Sistem çalışmıyor
[ ] Yüksek - Önemli işlev bozuk
[ ] Normal - Küçük sorun
[ ] Düşük - Kozmetik
```

---

### 3️⃣ REFACTORING

```
## Görev: Refactoring

### Hedef
[Hangi kod/modül refactor edilecek]

### Mevcut Sorunlar
- [Sorun 1]
- [Sorun 2]

### İstenen İyileştirmeler
- [ ] Kod tekrarını azalt
- [ ] Performans iyileştir
- [ ] Okunabilirliği artır
- [ ] Test edilebilirliği artır

### Kısıtlamalar
- Mevcut API kontratını değiştirme
- Backward compatibility koru
- Aşamalı değişiklik yap
```

---

### 4️⃣ DATABASE DEĞİŞİKLİĞİ

```
## Görev: Database Şema Değişikliği

### Değişiklik Türü
[ ] Yeni tablo
[ ] Mevcut tabloya kolon ekleme
[ ] Index ekleme
[ ] Trigger/Function
[ ] View

### Detaylar
[Şema değişikliğinin detayları]

### Migration Kuralları
- Dosya adı: XXX_aciklama.sql (sıradaki numara)
- Konum: /backend/src/migrations/
- IF NOT EXISTS kullan
- Foreign key'ler tanımla
- Index'leri unutma

### İlişkili Tablolar
[Bu değişiklikten etkilenecek tablolar]
```

---

### 5️⃣ API ENDPOINT EKLEMEk

```
## Görev: Yeni API Endpoint

### Endpoint Detayları
- Method: [GET/POST/PUT/DELETE]
- Path: /api/[path]
- Auth: [ ] Gerekli [ ] Gereksiz

### Request
```json
{
  // Beklenen request body
}
```

### Response (Success)
```json
{
  "success": true,
  "data": { }
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "Hata mesajı"
}
```

### Validasyonlar
- [Validation 1]
- [Validation 2]

### Database İşlemleri
[Hangi tablolara sorgu atılacak]
```

---

### 6️⃣ FRONTEND SAYFA/COMPONENT

```
## Görev: Frontend Geliştirme

### Sayfa/Component
- Tür: [ ] Page [ ] Component
- Konum: /frontend/src/[app veya components]/

### UI Gereksinimleri
[Görsel/fonksiyonel gereksinimler]

### State Yönetimi
[Hangi state'ler gerekli]

### API Bağlantıları
- [Endpoint 1]
- [Endpoint 2]

### Responsive
[ ] Desktop
[ ] Tablet
[ ] Mobile

### Kullanılacak Componentler
[Mevcut componentlerden hangilerini kullan]
```

---

### 7️⃣ AI ENTEGRASYONU

```
## Görev: AI Özelliği

### Kullanılacak Model
[ ] Gemini (döküman analizi)
[ ] Claude (konuşma/asistan)

### İşlev
[AI'ın ne yapacağı]

### Input
[AI'a verilecek veri]

### Expected Output
[AI'dan beklenen çıktı formatı]

### Error Handling
[API hatalarında ne yapılacak]

### Rate Limiting
[API limit yönetimi]
```

---

## 🎯 HIZLI PROMPT ÖRNEKLERİ

### Basit Bug Fix
```
/backend/src/routes/cariler.js dosyasında bakiye hesaplama hatası var.
Trigger çalışmıyor, manuel güncelle. Mevcut kodu incele ve düzelt.
```

### Yeni Endpoint
```
Stok kartlarını kategoriye göre gruplandıran GET /api/stok/kategoriler endpoint'i ekle.
Response: { success: true, data: [{ kategori: "X", urun_sayisi: 10 }] }
```

### Frontend Component
```
Muhasebe modülüne aylık gelir-gider grafiği ekle.
/frontend/src/app/muhasebe/page.tsx'e bar chart component'i entegre et.
API: GET /api/muhasebe/aylik-ozet
```

### Migration
```
personeller tablosuna "sgk_no" kolonu ekle.
Migration dosyası oluştur: 044_personel_sgk_no.sql
VARCHAR(20), nullable, index ekle.
```

---

## ⚠️ CURSOR'A VERİLMEMESİ GEREKENLER

1. ❌ API key'ler, şifreler
2. ❌ Prod database connection string
3. ❌ Müşteri verileri
4. ❌ Hassas iş mantığı
5. ❌ Güvenlik açıklarını expose eden kod

---

## 💡 İPUÇLARI

1. **Bağlam ver:** Her görevde projenin ne olduğunu kısaca belirt
2. **Spesifik ol:** "Düzelt" yerine "X dosyasındaki Y fonksiyonunu Z şekilde düzelt"
3. **Örnekle göster:** Input/output örnekleri ver
4. **Kısıtlamaları belirt:** Neyin değişmemesi gerektiğini söyle
5. **Parçala:** Büyük görevleri küçük adımlara böl
