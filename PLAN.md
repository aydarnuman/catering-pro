# AI Menü Sistemi - İmplementasyon Planı

## Strateji: Mevcut Altyapıya Entegre Et (Sıfırdan Değil)

Mevcut `ai-agent.js` + `menu-tools.js` + `ai_memory` sistemi çok güçlü.
Yeni sistem oluşturmak yerine mevcut tool'ları akıllandırıyoruz.

---

## Faz 1: DB Migration (Sadece 2 Yeni Tablo)

### 1a. `ai_menu_profilleri` tablosu
- Kurum profilleri: hastane, okul, şantiye, fabrika vb.
- Alanlar: id, ad, kod, aciklama, besin_hedefleri(JSONB), kurallar(JSONB), varsayilan_kurallar(JSONB), aktif
- Seed data: 4 hazır profil (hastane, okul, şantiye, genel)

### 1b. `ai_menu_edit_log` tablosu
- Düzenleme takibi (memory için input)
- Alanlar: id, menu_plan_id, tarih, ogun_kodu, action, original_recete_id, final_recete_id, user_id, created_at

### 1c. Memory için yeni tabloya GEREK YOK
- Mevcut `ai_memory` tablosunu `category='menu_planning'` ile kullanıyoruz
- Mevcut `ai_learned_facts` tablosunu edit log'dan öğrenme için kullanıyoruz

---

## Faz 2: Backend - menu-tools.js Akıllandırma

### 2a. Mevcut `aylik_menu_olustur` tool'unu yeniden yaz
- Şu an: Cycling ile reçete seçiyor (aptal)
- Yeni: Profil kuralları + besin dengesi + çeşitlilik + memory context ile seçim
- Memory'den geçmiş tercihleri oku (get_memory tool)
- Kural bazlı constraint'ler uygula ("Çarşamba balık", "haftada max 2 tavuk")

### 2b. Yeni tool'lar ekle (menu-tools.js'e)
- `get_menu_profile` — Kurum profili getir (besin hedefleri + kurallar)
- `check_weekly_nutrition` — Haftalık besin dengesi kontrol (kalori, protein, çeşitlilik)
- `check_variety` — Tekrar kontrolü (son 7 günde aynı yemek var mı)
- `save_menu_preference` — Öğrenme: tercihi ai_memory'ye kaydet
- `regenerate_day_menu` — Tek günü yeniden üret (diğer günleri context olarak al)
- `regenerate_meal` — Tek öğünü yeniden üret

### 2c. Profil CRUD endpoint'leri (ai-features.js'e ekle)
- `GET /ai/profiles` — Profil listesi
- `POST /ai/profiles` — Yeni profil
- `PUT /ai/profiles/:id` — Profil güncelle
- `DELETE /ai/profiles/:id` — Profil sil

---

## Faz 3: Backend - AI Menü Üretim Endpoint'leri

### 3a. `POST /menu-planlama/ai/generate-menu` (ai-features.js'e)
- Input: { projeId, profilKodu, sureTipi, baslangicTarihi, kisiSayisi, kurallar[], prompt }
- İç akış:
  1. Profil yükle → besin hedefleri + kurallar
  2. Memory yükle → geçmiş tercihler (ai_memory, category='menu_planning')
  3. Mevcut reçeteleri yükle (kategoriye göre)
  4. `ai-agent.js`'in processQuery() ile Claude'a gönder
  5. Claude tool'ları kullanarak menü oluşturur
  6. Response'u takvimState formatına dönüştür
- Output: { takvimState, maliyet_ozet, besin_ozet }

### 3b. `POST /menu-planlama/ai/regenerate-day`
- Input: { planContext (diğer günler), tarih, kurallar[] }
- Claude diğer günleri görür → tekrar önler
- Output: { gunMenusu }

### 3c. `POST /menu-planlama/ai/regenerate-meal`
- Input: { planContext, tarih, ogunKodu, kurallar[] }
- Output: { ogunMenusu }

---

## Faz 4: Backend - Edit Log + Öğrenme Motoru

### 4a. Edit log kayıt mekanizması
- Mevcut kayıt endpoint'ini genişlet: menü kaydederken AI üretimi ise edit_log'a yaz
- `action` tipleri: 'ai_placed', 'kept', 'replaced', 'removed', 'added_manual'

### 4b. Öğrenme motoru (`POST /menu-planlama/ai/learn`)
- Edit log'dan pattern çıkar:
  - "X yemeği 5 kez silindi" → ai_learned_facts'e rejection olarak yaz
  - "Y yemeği hiç değiştirilmedi" → ai_learned_facts'e approval olarak yaz
  - "Cuma balık hep kalıyor" → pattern olarak kaydet
- Confidence: hit_count/total * 1.0 (min 3 sample)
- Verified olanlar otomatik ai_memory'ye promote (mevcut mekanizma)

---

## Faz 5: Frontend - AI Menü Modal

### 5a. `AiMenuModal.tsx` (yeni bileşen)
- Üst kısım: Profil seçici (Select) + Süre (haftalık/15 gün/aylık) + Kişi sayısı
- Orta kısım: Serbest prompt textarea
- Alt kısım: Hızlı kural ekleme UI
  - Gün seçici + Öğün seçici + Kategori/Reçete seçici
  - Eklenen kurallar chip'ler halinde görünsün
- Buton: "Menü Oluştur" (loading state)

### 5b. MenuTakvim.tsx'e entegrasyon
- "AI ile Menü Oluştur" butonu (header'da, "Planı Kaydet" yanına)
- Sağ tık context menüsü: "Bu günü AI ile yeniden üret" + "Bu öğünü AI ile yeniden üret"
- AI üretim sonrası: takvimState'i populate et (mevcut formatla uyumlu)

### 5c. `AiProfilYonetimi.tsx` (profil CRUD paneli)
- Profil listesi + yeni profil oluşturma
- Besin hedefleri formu (kalori, protein, karb, yağ)
- Kurallar formu (gün bazlı default'lar)

---

## Faz 6: Frontend - Memory UI

### 6a. `AiMemoryPanel.tsx` (yeni bileşen)
- Menü planlama sayfasında ayrı tab veya profil detayında panel
- Gösterim: Tercihler, Redler, Onaylar listesi (confidence skoru ile)
- Düzenleme: Memory silebilme, importance değiştirebilme
- Kaynak: Mevcut `/api/ai/memory?category=menu_planning` endpoint'i

### 6b. Edit log görüntüleme (opsiyonel)
- Son AI üretimlerinde ne değiştirildiğinin özeti
- "AI şunu koydu, siz bunu yaptınız" formatında

---

## Dosya Değişiklikleri Özeti

### Yeni Dosyalar
- `supabase/migrations/XXXX_ai_menu_profilleri.sql` (migration)
- `frontend/.../components/AiMenuModal.tsx`
- `frontend/.../components/AiProfilYonetimi.tsx`
- `frontend/.../components/AiMemoryPanel.tsx`

### Değiştirilecek Dosyalar
- `backend/src/services/ai-tools/menu-tools.js` — 6 yeni tool + mevcut tool'ları iyileştir
- `backend/src/services/ai-tools/index.js` — Yeni tool'lar otomatik register olur (manifest)
- `backend/src/routes/menu-planlama/ai-features.js` — 6 yeni endpoint (generate, regenerate, profil CRUD, learn)
- `frontend/.../components/MenuTakvim.tsx` — AI butonu + sağ tık menüsü
- `frontend/.../components/MenuPlanlamaContext.tsx` — AI state yönetimi
- `frontend/src/lib/api/services/menu-planlama.ts` — Yeni API çağrıları

### Dokunulmayacak Dosyalar (mevcut altyapı)
- `ai-agent.js` — Olduğu gibi, processQuery() kullanılacak
- `claude-ai.js` — Olduğu gibi
- `ai.config.js` — Olduğu gibi
- `ai-tools/index.js` — Manifest auto-discovery zaten çalışıyor
- `ai_memory` tablosu — category='menu_planning' ile yeni kayıtlar
- `ai_learned_facts` tablosu — edit log'dan öğrenme

---

## Uygulama Sırası

1. **Faz 1** (DB) → Faz 2 (Tools) → Faz 3 (Endpoints) — Backend tamam
2. **Faz 5** (Modal + Takvim) — Frontend temel
3. **Faz 4** (Edit log + Öğrenme) — Akıllanma
4. **Faz 6** (Memory UI) — Kullanıcı yönetimi
