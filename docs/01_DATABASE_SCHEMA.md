# 🗄️ Veritabanı Şeması

> Platform: PostgreSQL (Supabase)  
> Migrations: 93 dosya  
> Son Güncelleme: 27 Ocak 2026

---

## 📋 Tablo İndeksi

| Kategori | Tablo Sayısı |
|----------|--------------|
| [Kullanıcı & Auth](#1-kullanıcı--auth) | 6 |
| [İhale Yönetimi](#2-i̇hale-yönetimi) | 8 |
| [Muhasebe - Cariler](#3-muhasebe---cariler) | 2 |
| [Muhasebe - Faturalar](#4-muhasebe---faturalar) | 3 |
| [Muhasebe - Stok](#5-muhasebe---stok) | 6 |
| [Muhasebe - Finans](#6-muhasebe---finans) | 4 |
| [Personel & Bordro](#7-personel--bordro) | 8 |
| [Ürün & Reçete](#8-ürün--reçete) | 6 |
| [Satın Alma](#9-satın-alma) | 2 |
| [AI & Sistem](#10-ai--sistem) | 8 |

---

## 1. Kullanıcı & Auth

### `users`
Ana kullanıcı tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | Birincil anahtar |
| email | VARCHAR(255) | E-posta (unique) |
| password_hash | VARCHAR(255) | Şifrelenmiş parola |
| name | VARCHAR(100) | Kullanıcı adı |
| role | VARCHAR(20) | Rol (admin/user) |
| is_active | BOOLEAN | Aktif durumu |
| created_at | TIMESTAMP | Oluşturma tarihi |
| updated_at | TIMESTAMP | Güncelleme tarihi |

### `user_sessions`
Oturum yönetimi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | users referansı |
| token | VARCHAR(500) | JWT token |
| device_info | JSONB | Cihaz bilgisi |
| ip_address | VARCHAR(45) | IP adresi |
| expires_at | TIMESTAMP | Sona erme |
| created_at | TIMESTAMP | |

### `refresh_tokens`
Token yenileme

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | users referansı |
| token | VARCHAR(500) | Refresh token |
| expires_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

### `ip_access_rules`
IP erişim kuralları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| ip_address | VARCHAR(45) | IP adresi |
| rule_type | VARCHAR(20) | allow/deny |
| description | TEXT | Açıklama |
| active | BOOLEAN | Aktif durumu |

### `permissions`
Yetki tanımları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| name | VARCHAR(100) | Yetki adı |
| code | VARCHAR(50) | Yetki kodu |
| module | VARCHAR(50) | Modül |
| description | TEXT | Açıklama |

### `user_permissions`
Kullanıcı-yetki ilişkisi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | users referansı |
| permission_id | INTEGER FK | permissions referansı |

---

## 2. İhale Yönetimi

### `tenders`
Ana ihale tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| external_id | VARCHAR(50) | Dış sistem ID (unique) |
| ikn | VARCHAR(50) | İhale Kayıt No |
| title | TEXT | İhale başlığı |
| publish_date | DATE | Yayın tarihi |
| tender_date | TIMESTAMP | İhale tarihi |
| city | VARCHAR(100) | Şehir |
| location | TEXT | Lokasyon |
| organization_name | TEXT | Kurum adı |
| estimated_cost | DECIMAL(15,2) | Tahmini bedel |
| tender_type | VARCHAR(100) | İhale tipi |
| url | TEXT | İhale URL |
| status | VARCHAR(20) | Durum (active/closed/won/lost) |
| detail_scraped | BOOLEAN | Detay çekildi mi |
| scraped_at | TIMESTAMP | Scraping zamanı |

### `documents`
İhale belgeleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tender_id | INTEGER FK | tenders referansı |
| filename | VARCHAR(255) | Dosya adı |
| original_filename | VARCHAR(255) | Orijinal dosya adı |
| file_type | VARCHAR(50) | Dosya tipi |
| file_size | INTEGER | Boyut (byte) |
| file_path | TEXT | Dosya yolu |
| extracted_text | TEXT | Çıkarılan metin |
| ocr_result | JSONB | OCR sonucu |
| analysis_result | JSONB | AI analiz sonucu |
| processing_status | VARCHAR(50) | İşleme durumu |

### `tender_tracking`
İhale takip listesi

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tender_id | INTEGER FK | tenders referansı |
| status | VARCHAR(50) | Takip durumu |
| priority | INTEGER | Öncelik |
| notes | TEXT | Notlar |
| assigned_to | INTEGER FK | Atanan kullanıcı |
| deadline | TIMESTAMP | Son tarih |

### `teklifler`
Teklif kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tender_id | INTEGER FK | tenders referansı |
| teklif_tutari | DECIMAL(15,2) | Teklif tutarı |
| birim_fiyatlar | JSONB | Birim fiyatları |
| teklif_tarihi | DATE | Teklif tarihi |
| gecerlilik_suresi | INTEGER | Gün |
| durum | VARCHAR(30) | Durum |

### `ihale_sonuclari`
İhale sonuçları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tender_id | INTEGER FK | tenders referansı |
| kazanan_firma | VARCHAR(255) | Kazanan |
| kazanan_tutar | DECIMAL(15,2) | Tutar |
| bizim_siralama | INTEGER | Sıralamamız |
| katilimci_sayisi | INTEGER | Toplam katılımcı |
| sonuc_tarihi | DATE | Sonuç tarihi |

### `tender_content_documents`
İhale içerik belgeleri

### `tender_notes`
İhale notları

### `tender_dilekceleri`
İhale dilekçeleri

---

## 3. Muhasebe - Cariler

### `cariler`
Müşteri/Tedarikçi ana tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tip | VARCHAR(20) | musteri/tedarikci/her_ikisi |
| unvan | VARCHAR(255) | Ticari ünvan |
| yetkili | VARCHAR(100) | Yetkili kişi |
| vergi_no | VARCHAR(20) | Vergi numarası |
| vergi_dairesi | VARCHAR(100) | Vergi dairesi |
| telefon | VARCHAR(50) | Telefon |
| email | VARCHAR(100) | E-posta |
| adres | TEXT | Adres |
| il | VARCHAR(50) | İl |
| ilce | VARCHAR(50) | İlçe |
| borc | DECIMAL(15,2) | Borç |
| alacak | DECIMAL(15,2) | Alacak |
| bakiye | DECIMAL(15,2) | Bakiye (computed) |
| kredi_limiti | DECIMAL(15,2) | Kredi limiti |
| banka_adi | VARCHAR(100) | Banka |
| iban | VARCHAR(34) | IBAN |
| aktif | BOOLEAN | Aktif durumu |

### `cari_hareketleri`
Cari hesap hareketleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| cari_id | INTEGER FK | cariler referansı |
| hareket_tipi | VARCHAR(30) | borc/alacak/tahsilat/odeme |
| tutar | DECIMAL(15,2) | Tutar |
| aciklama | TEXT | Açıklama |
| belge_no | VARCHAR(50) | Belge numarası |
| fatura_id | INTEGER FK | invoices referansı |
| tarih | DATE | İşlem tarihi |

---

## 4. Muhasebe - Faturalar

### `invoices`
Ana fatura tablosu (Uyumsoft sync)

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| ettn | VARCHAR(100) | e-Fatura ETTN (unique) |
| invoice_no | VARCHAR(50) | Fatura numarası |
| invoice_type | VARCHAR(20) | sales/purchase |
| invoice_date | DATE | Fatura tarihi |
| due_date | DATE | Vade tarihi |
| customer_name | VARCHAR(255) | Müşteri/Tedarikçi |
| customer_tax_no | VARCHAR(20) | VKN |
| total_amount | DECIMAL(15,2) | Toplam tutar |
| vat_amount | DECIMAL(15,2) | KDV tutarı |
| status | VARCHAR(30) | Durum |
| proje_id | INTEGER FK | projeler referansı |

### `uyumsoft_invoices`
Uyumsoft'tan gelen ham faturalar

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| ettn | VARCHAR(100) | ETTN (unique) |
| invoice_no | VARCHAR(50) | Fatura no |
| sender_name | VARCHAR(255) | Gönderen |
| sender_tax_no | VARCHAR(20) | VKN |
| invoice_date | DATE | Tarih |
| total_amount | DECIMAL(15,2) | Tutar |
| raw_xml | TEXT | Ham XML |
| items | JSONB | Kalemler (JSON) |

### `fatura_kalemleri`
Fatura kalem detayları (TEK KAYNAK)

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| fatura_ettn | VARCHAR(100) | Fatura ETTN |
| kalem_sira | INTEGER | Sıra no |
| orijinal_urun_adi | TEXT | Orijinal ürün adı |
| orijinal_urun_kodu | VARCHAR(100) | Orijinal kod |
| miktar | DECIMAL(15,3) | Miktar |
| birim | VARCHAR(20) | Birim |
| birim_fiyat | DECIMAL(15,4) | Birim fiyat |
| tutar | DECIMAL(15,2) | Tutar |
| kdv_orani | DECIMAL(5,2) | KDV % |
| kdv_tutari | DECIMAL(15,2) | KDV tutarı |
| tedarikci_vkn | VARCHAR(20) | Tedarikçi VKN |
| tedarikci_ad | VARCHAR(200) | Tedarikçi adı |
| fatura_tarihi | DATE | Fatura tarihi |
| urun_id | INTEGER FK | urun_kartlari referansı |
| eslestirme_tarihi | TIMESTAMP | Eşleştirme zamanı |

**Unique:** (fatura_ettn, kalem_sira)

---

## 5. Muhasebe - Stok

### `stok_kartlari`
Stok kartları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| kod | VARCHAR(50) | Stok kodu (unique) |
| ad | VARCHAR(255) | Ürün adı |
| kategori | VARCHAR(100) | Kategori |
| birim | VARCHAR(20) | Birim |
| miktar | DECIMAL(15,3) | Mevcut miktar |
| min_stok | DECIMAL(15,3) | Minimum stok |
| max_stok | DECIMAL(15,3) | Maksimum stok |
| kritik_stok | BOOLEAN | Kritik durumu (computed) |
| alis_fiyati | DECIMAL(15,2) | Alış fiyatı |
| satis_fiyati | DECIMAL(15,2) | Satış fiyatı |
| kdv_orani | INTEGER | KDV % |
| tedarikci_id | INTEGER FK | cariler referansı |
| aktif | BOOLEAN | Aktif durumu |

### `stok_hareketleri`
Stok hareketleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| stok_id | INTEGER FK | stok_kartlari referansı |
| hareket_tipi | VARCHAR(20) | giris/cikis/transfer/sayim |
| miktar | DECIMAL(15,3) | Miktar |
| onceki_miktar | DECIMAL(15,3) | Önceki miktar |
| sonraki_miktar | DECIMAL(15,3) | Sonraki miktar |
| birim_fiyat | DECIMAL(15,2) | Birim fiyat |
| fatura_id | INTEGER FK | |
| cari_id | INTEGER FK | |
| tarih | DATE | İşlem tarihi |

### `depolar`
Depo tanımları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| ad | VARCHAR(100) | Depo adı |
| kod | VARCHAR(20) | Depo kodu |
| adres | TEXT | Adres |
| yetkili | VARCHAR(100) | Yetkili |
| aktif | BOOLEAN | Aktif durumu |

### `depo_stoklari`
Depo bazlı stok miktarları

### `lokasyonlar`
Depo içi lokasyonlar

### `demirbas`
Demirbaş kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| kod | VARCHAR(50) | Demirbaş kodu |
| ad | VARCHAR(255) | Demirbaş adı |
| kategori | VARCHAR(100) | Kategori |
| marka | VARCHAR(100) | Marka |
| model | VARCHAR(100) | Model |
| seri_no | VARCHAR(100) | Seri no |
| alis_tarihi | DATE | Alış tarihi |
| alis_fiyati | DECIMAL(15,2) | Alış fiyatı |
| amortisman_orani | DECIMAL(5,2) | Amortisman % |
| lokasyon | VARCHAR(100) | Lokasyon |
| sorumlu_id | INTEGER FK | personeller referansı |
| durum | VARCHAR(30) | Durum |

---

## 6. Muhasebe - Finans

### `kasa_banka_hesaplari`
Kasa ve banka hesapları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| hesap_tipi | VARCHAR(20) | kasa/banka |
| hesap_adi | VARCHAR(100) | Hesap adı |
| banka_adi | VARCHAR(100) | Banka adı |
| iban | VARCHAR(34) | IBAN |
| para_birimi | VARCHAR(3) | TRY/USD/EUR |
| bakiye | DECIMAL(15,2) | Güncel bakiye |
| aktif | BOOLEAN | Aktif durumu |
| varsayilan | BOOLEAN | Varsayılan hesap |

### `kasa_banka_hareketleri`
Kasa/banka hareketleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| hesap_id | INTEGER FK | kasa_banka_hesaplari referansı |
| hareket_tipi | VARCHAR(20) | giris/cikis/transfer |
| tutar | DECIMAL(15,2) | Tutar |
| onceki_bakiye | DECIMAL(15,2) | Önceki bakiye |
| sonraki_bakiye | DECIMAL(15,2) | Sonraki bakiye |
| karsi_hesap_id | INTEGER FK | Transfer için |
| aciklama | TEXT | Açıklama |
| tarih | DATE | İşlem tarihi |

### `gelir_giderler`
Gelir/gider kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| tip | VARCHAR(10) | gelir/gider |
| kategori | VARCHAR(100) | Kategori |
| aciklama | TEXT | Açıklama |
| tutar | DECIMAL(15,2) | Tutar |
| kdv_dahil | BOOLEAN | KDV dahil mi |
| kdv_orani | INTEGER | KDV % |
| cari_id | INTEGER FK | |
| fatura_id | INTEGER FK | |
| odeme_yontemi | VARCHAR(30) | Ödeme yöntemi |
| durum | VARCHAR(20) | beklemede/odendi/iptal |
| tarih | DATE | İşlem tarihi |
| vade_tarihi | DATE | Vade tarihi |

### `cek_senetler`
Çek/senet kayıtları

---

## 7. Personel & Bordro

### `personeller`
Personel ana tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| sicil_no | VARCHAR(20) | Sicil no (unique) |
| tc_kimlik | VARCHAR(11) | TC Kimlik (unique) |
| ad | VARCHAR(50) | Ad |
| soyad | VARCHAR(50) | Soyad |
| tam_ad | VARCHAR(101) | Ad Soyad (computed) |
| telefon | VARCHAR(50) | Telefon |
| email | VARCHAR(100) | E-posta |
| adres | TEXT | Adres |
| departman | VARCHAR(100) | Departman |
| pozisyon | VARCHAR(100) | Pozisyon |
| ise_giris_tarihi | DATE | İşe giriş |
| isten_cikis_tarihi | DATE | İşten çıkış |
| aktif | BOOLEAN | Aktif (computed) |
| maas | DECIMAL(15,2) | Brüt maaş |
| maas_tipi | VARCHAR(20) | aylik/haftalik/gunluk |
| iban | VARCHAR(34) | IBAN |
| medeni_durum | VARCHAR(20) | Medeni durum |
| es_calisiyormu | BOOLEAN | Eş çalışıyor mu |
| cocuk_sayisi | INTEGER | Çocuk sayısı |
| engel_derecesi | INTEGER | Engel derecesi |
| sgk_no | VARCHAR(20) | SGK no |
| yemek_yardimi | DECIMAL(15,2) | Yemek yardımı |
| yol_yardimi | DECIMAL(15,2) | Yol yardımı |

### `bordro_kayitlari`
Aylık bordro kayıtları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| personel_id | INTEGER FK | personeller referansı |
| yil | INTEGER | Yıl |
| ay | INTEGER | Ay (1-12) |
| calisma_gunu | INTEGER | Çalışma günü |
| fazla_mesai_saat | DECIMAL(10,2) | FM saati |
| brut_maas | DECIMAL(15,2) | Brüt maaş |
| brut_toplam | DECIMAL(15,2) | Brüt toplam |
| sgk_matrahi | DECIMAL(15,2) | SGK matrahı |
| sgk_isci | DECIMAL(15,2) | SGK işçi (%14) |
| issizlik_isci | DECIMAL(15,2) | İşsizlik (%1) |
| toplam_isci_sgk | DECIMAL(15,2) | Toplam SGK işçi |
| vergi_matrahi | DECIMAL(15,2) | Vergi matrahı |
| kumulatif_matrah | DECIMAL(15,2) | Kümülatif matrah |
| gelir_vergisi | DECIMAL(15,2) | Gelir vergisi |
| damga_vergisi | DECIMAL(15,2) | Damga vergisi |
| agi_tutari | DECIMAL(15,2) | AGİ |
| net_maas | DECIMAL(15,2) | Net maaş |
| sgk_isveren | DECIMAL(15,2) | SGK işveren |
| issizlik_isveren | DECIMAL(15,2) | İşsizlik işveren |
| toplam_maliyet | DECIMAL(15,2) | Toplam maliyet |
| odeme_durumu | VARCHAR(20) | beklemede/odendi/iptal |
| odeme_tarihi | DATE | Ödeme tarihi |

**Unique:** (personel_id, yil, ay)

### `vergi_dilimleri`
Yıllık vergi dilimleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| yil | INTEGER | Yıl |
| baslangic | DECIMAL(15,2) | Alt sınır |
| bitis | DECIMAL(15,2) | Üst sınır |
| oran | DECIMAL(5,4) | Vergi oranı |

### `asgari_ucret`
Asgari ücret tablosu

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| yil | INTEGER | Yıl |
| donem | INTEGER | 1: Ocak-Haziran, 2: Temmuz-Aralık |
| brut_ucret | DECIMAL(15,2) | Brüt |
| net_ucret | DECIMAL(15,2) | Net |

### `izin_talepleri`
İzin talepleri

### `personel_projeleri`
Personel-proje atamaları

### `maas_odemeleri`
Maaş ödeme kayıtları

### `tazminat_hesaplamalari`
Tazminat hesaplamaları

---

## 8. Ürün & Reçete

### `urun_kategorileri`
Ürün kategorileri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| ad | VARCHAR(100) | Kategori adı (unique) |
| ikon | VARCHAR(10) | Emoji ikon |
| sira | INTEGER | Sıralama |
| aktif | BOOLEAN | Aktif durumu |

### `urun_kartlari`
Ürün kartları (reçete için temiz isimler)

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| kod | VARCHAR(20) | Ürün kodu (unique, auto) |
| ad | VARCHAR(200) | Ürün adı |
| kategori_id | INTEGER FK | urun_kategorileri referansı |
| varsayilan_birim | VARCHAR(20) | Varsayılan birim |
| stok_kart_id | INTEGER FK | stok_kartlari referansı |
| manuel_fiyat | DECIMAL(15,2) | Manuel fiyat |
| fiyat_birimi | VARCHAR(20) | kg/lt/adet |
| ikon | VARCHAR(10) | Emoji |
| aktif | BOOLEAN | Aktif durumu |

### `receteler`
Reçete tanımları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| kod | VARCHAR(50) | Reçete kodu |
| ad | VARCHAR(255) | Reçete adı |
| kategori | VARCHAR(100) | Kategori |
| porsiyon_sayisi | INTEGER | Porsiyon |
| hazirlik_suresi | INTEGER | Dakika |
| pisirme_suresi | INTEGER | Dakika |
| talimatlar | TEXT | Hazırlık talimatları |
| aktif | BOOLEAN | Aktif durumu |

### `recete_malzemeler`
Reçete malzemeleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| recete_id | INTEGER FK | receteler referansı |
| urun_kart_id | INTEGER FK | urun_kartlari referansı |
| miktar | DECIMAL(15,3) | Miktar |
| birim | VARCHAR(20) | Birim |
| notlar | TEXT | Notlar |

### `menuler`
Menü planları

### `sartnameler`
Gramaj şartnameleri

---

## 9. Satın Alma

### `satin_alma_talepleri`
Satın alma talepleri

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| talep_no | VARCHAR(50) | Talep no (unique) |
| talep_eden | VARCHAR(100) | Talep eden |
| departman | VARCHAR(100) | Departman |
| konu | VARCHAR(255) | Konu |
| aciklama | TEXT | Açıklama |
| aciliyet | VARCHAR(20) | dusuk/normal/yuksek/acil |
| durum | VARCHAR(30) | beklemede/onaylandi/reddedildi/tamamlandi |
| onaylayan | VARCHAR(100) | Onaylayan |
| tahmini_tutar | DECIMAL(15,2) | Tahmini tutar |
| gerceklesen_tutar | DECIMAL(15,2) | Gerçekleşen |
| tedarikci_id | INTEGER FK | cariler referansı |
| talep_tarihi | DATE | Talep tarihi |
| termin_tarihi | DATE | Termin tarihi |

### `satin_alma_kalemleri`
Satın alma talep kalemleri

---

## 10. AI & Sistem

### `ai_memory`
AI sohbet hafızası

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | users referansı |
| conversation_id | VARCHAR(100) | Konuşma ID |
| role | VARCHAR(20) | user/assistant |
| content | TEXT | Mesaj içeriği |
| metadata | JSONB | Metadata |
| created_at | TIMESTAMP | Zaman |

### `ai_prompt_templates`
AI prompt şablonları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| name | VARCHAR(100) | Şablon adı |
| category | VARCHAR(50) | Kategori |
| system_prompt | TEXT | Sistem promptu |
| user_prompt_template | TEXT | Kullanıcı şablonu |
| model | VARCHAR(50) | Model adı |
| temperature | DECIMAL(3,2) | Temperature |
| is_active | BOOLEAN | Aktif durumu |

### `notifications`
Bildirimler

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | Hedef kullanıcı |
| title | VARCHAR(255) | Başlık |
| message | TEXT | Mesaj |
| type | VARCHAR(50) | Tip |
| is_read | BOOLEAN | Okundu mu |
| link | TEXT | Yönlendirme linki |
| created_at | TIMESTAMP | Zaman |

### `audit_logs`
Denetim logları

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | SERIAL PK | |
| user_id | INTEGER FK | Kullanıcı |
| action | VARCHAR(100) | Aksiyon |
| module | VARCHAR(50) | Modül |
| entity_type | VARCHAR(50) | Varlık tipi |
| entity_id | INTEGER | Varlık ID |
| old_values | JSONB | Eski değerler |
| new_values | JSONB | Yeni değerler |
| ip_address | VARCHAR(45) | IP |
| user_agent | TEXT | User agent |
| created_at | TIMESTAMP | Zaman |

### `scraper_logs`
Scraper logları

### `sync_logs`
Senkronizasyon logları

### `user_preferences`
Kullanıcı tercihleri

### `admin_notifications`
Admin bildirimleri

---

## 🔗 Tablo İlişkileri (ER Diagram)

```
┌─────────────┐       ┌─────────────┐
│   users     │───────│ permissions │
└──────┬──────┘       └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐       ┌─────────────┐
│  tenders    │───────│  documents  │
└──────┬──────┘       └─────────────┘
       │
       │ 1:N
       ▼
┌──────────────────┐
│ tender_tracking  │
└──────────────────┘

┌─────────────┐       ┌─────────────────┐
│   cariler   │───────│ cari_hareketleri│
└──────┬──────┘       └─────────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐       ┌───────────────────┐
│  invoices   │───────│ fatura_kalemleri  │
└─────────────┘       └─────────┬─────────┘
                                │
                                │ N:1
                                ▼
┌─────────────────┐   ┌─────────────────┐
│ urun_kategorileri│──│  urun_kartlari  │
└─────────────────┘   └─────────────────┘

┌─────────────┐       ┌─────────────────┐
│ personeller │───────│ bordro_kayitlari│
└─────────────┘       └─────────────────┘
```

---

## 🔑 Önemli Trigger'lar

| Trigger | Tablo | İşlev |
|---------|-------|-------|
| `update_updated_at` | Çoğu tablo | updated_at otomatik güncelle |
| `update_stok_miktar` | stok_hareketleri | Stok miktarı güncelle |
| `update_kasa_banka_bakiye` | kasa_banka_hareketleri | Bakiye güncelle |
| `update_cari_bakiye` | cari_hareketleri | Cari bakiye güncelle |
| `generate_urun_kodu` | urun_kartlari | Otomatik kod üret |

---

## 📊 Önemli View'lar

| View | Açıklama |
|------|----------|
| `active_tenders` | Aktif ihaleler |
| `kritik_stoklar` | Kritik stok durumu |
| `cari_ozet` | Cari hesap özeti |
| `aylik_gelir_gider_ozet` | Aylık finansal özet |
| `kasa_banka_durum` | Kasa/banka durumu |
| `bordro_aylik_ozet` | Bordro özeti |
| `v_urun_guncel_fiyat` | Ürün güncel fiyatları |
| `v_urun_fiyat_gecmisi` | Fiyat geçmişi |
| `v_fatura_eslesme_durumu` | Fatura eşleşme durumu |

---

*Bu döküman migration dosyalarından otomatik olarak oluşturulmuştur.*
