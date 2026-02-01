# Database Schema Complete Reference

**Generated:** 2026-01-31
**Total Migrations:** 110 Supabase + 106 Backend
**Total Tables:** 60+ tables

---

## Table of Contents

1. [İhale/Tender Module](#ihale-tender-module)
2. [Finans/Accounting Module](#finans-accounting-module)
3. [Personel/HR Module](#personel-hr-module)
4. [Stok/Inventory Module](#stok-inventory-module)
5. [Reçete/Menu Module](#recete-menu-module)
6. [System/Core Module](#system-core-module)
7. [Supporting Tables](#supporting-tables)
8. [Migration History](#migration-history)
9. [Naming Inconsistencies](#naming-inconsistencies)

---

## İhale (Tender) Module

### Core Tables

#### **tenders**
Tracks public tenders from government procurement systems.

**Migration:** `20260128000001`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| kurum | text | Institution name |
| ihale_konusu | text | Tender subject |
| dosya_no | text | File number |
| ihale_tarihi | date | Tender date |
| aciklama | text | Description |
| tahmin_bedeli | numeric | Estimated price |
| gereklilik | text | Requirements |
| url | text | Source URL |
| scraper_source | text | Scraper identifier |
| created_at | timestamp | Record creation |

---

#### **teklifler** (Bid Proposals)
Stores company bids/proposals for tenders.

**Migration:** `20260128000044`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tender_id | uuid | FK to tenders |
| firma_id | uuid | FK to firmalar |
| teklif_tutari | numeric | Bid amount |
| teklif_tarihi | date | Bid submission date |
| durum | text | Status (hazirlik, sunuldu, kazanildi, kaybedildi) |
| notlar | text | Internal notes |
| belgeler | jsonb | Document references |

---

#### **firmalar** (Companies)
Company registry for tender participants.

**Migration:** `20260128000048`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| unvan | text | Company legal name |
| vergi_no | text | Tax ID |
| adres | text | Address |
| telefon | text | Phone |
| email | text | Email |
| yetkili_kisi | text | Contact person |
| notlar | text | Notes |
| ekstra_alanlar | jsonb | Dynamic fields (migration 058) |

---

#### **ihale_sonuclari** (Tender Results)
Final outcomes of tender processes.

**Migration:** `20260128000049`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tender_id | uuid | FK to tenders |
| kazanan_firma_id | uuid | FK to firmalar (winning company) |
| kazanan_teklif | numeric | Winning bid amount |
| sonuc_tarihi | date | Result date |
| diger_teklifler | jsonb | Other bids submitted |

---

#### **tender_dilekçeleri** (Tender Petitions)
Auto-generated tender application documents.

**Migration:** `20260128000072`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tender_id | uuid | FK to tenders |
| firma_id | uuid | FK to firmalar |
| dilekce_metni | text | Generated petition text |
| olusturma_tarihi | timestamp | Creation timestamp |

---

#### **documents**
Document storage for tender attachments.

**Migration:** `20260128000001`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tender_id | uuid | FK to tenders |
| file_name | text | Original filename |
| file_path | text | Storage path |
| file_type | text | MIME type |
| file_size | bigint | Size in bytes |
| uploaded_at | timestamp | Upload timestamp |

---

#### **scraper_logs**
Logs for automated tender scraping.

**Migration:** `20260128000001`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| source | text | Scraper source identifier |
| status | text | success/failure |
| records_found | integer | Count of tenders found |
| error_message | text | Error details |
| scraped_at | timestamp | Execution time |

---

### Supporting Tender Tables

- **tender_content_documents** (migration 051) - Advanced document management
- **scraper_queue** (migration 103) - Queue system for scraping jobs

---

## Finans/Accounting Module

### Invoice Tables

#### **invoices**
Manual invoice management.

**Migration:** `20260128000004`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| ettn | text | Unique invoice number |
| fatura_no | text | Invoice number |
| fatura_tarihi | date | Invoice date |
| tedarikci_adi | text | Supplier name |
| toplam_tutar | numeric | Total amount |
| kdv_tutari | numeric | VAT amount |
| durum | text | Status (draft, approved, paid) |
| created_at | timestamp | Record creation |

---

#### **invoice_items**
Line items for manual invoices.

**Migration:** `20260128000004`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| invoice_id | uuid | FK to invoices |
| urun_adi | text | Product name |
| miktar | numeric | Quantity |
| birim | text | Unit |
| birim_fiyat | numeric | Unit price |
| toplam | numeric | Line total |

---

#### **uyumsoft_invoices**
Imported invoices from Uyumsoft system.

**Migration:** `20260128000004`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| ettn | text | e-Invoice ETTN |
| tedarikci_vkn | text | Supplier tax ID |
| tedarikci_adi | text | Supplier name |
| fatura_tarihi | date | Invoice date |
| toplam_tutar | numeric(15,2) | Total amount |
| kdv_tutari | numeric(15,2) | VAT amount |
| imported_at | timestamp | Import timestamp |

---

#### **uyumsoft_invoice_items**
Line items from Uyumsoft invoices.

**Migration:** `20260128000004`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| uyumsoft_invoice_id | uuid | FK to uyumsoft_invoices |
| urun_kodu | text | Product code |
| urun_adi | text | Product name |
| miktar | numeric | Quantity |
| birim | text | Unit |
| birim_fiyat | numeric | Unit price |
| stok_kart_id | uuid | FK to stok_kartlari (migration 092) |
| eslesme_durumu | text | Matching status (migration 091) |

---

#### **invoice_payments**
Payment tracking for invoices.

**Migration:** `20260128000004`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| invoice_id | uuid | FK to invoices |
| odeme_tarihi | date | Payment date |
| odeme_tutari | numeric | Payment amount |
| odeme_yontemi | text | Payment method |
| notlar | text | Notes |

---

### Cari (Party/Vendor) Tables

#### **cariler**
Customer and vendor registry.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| unvan | text | Legal name |
| vergi_no | text | Tax ID (unique) |
| cari_tipi | text | Type (musteri, tedarikci, both) |
| telefon | text | Phone |
| email | text | Email |
| adres | text | Address |
| bakiye | numeric | Current balance |
| created_at | timestamp | Record creation |

---

#### **cari_hareketler**
Transactions for parties.

**Migration:** `20260128000007`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| cari_id | uuid | FK to cariler |
| tarih | date | Transaction date |
| tip | text | Type (borc, alacak) |
| tutar | numeric | Amount |
| aciklama | text | Description |
| fatura_id | uuid | FK to invoices (optional) |

---

### Financial Operations

#### **gelir_giderler** (Income/Expenses)
Cash flow tracking.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tip | text | Type (gelir, gider) |
| kategori | text | Category |
| tutar | numeric | Amount |
| tarih | date | Transaction date |
| aciklama | text | Description |
| proje_id | uuid | FK to projeler (optional) |

---

#### **kasa_banka_hesaplari** (Cash & Bank Accounts)
Financial account registry.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| hesap_adi | text | Account name |
| hesap_tipi | text | Type (kasa, banka) |
| banka_adi | text | Bank name (if applicable) |
| iban | text | IBAN |
| bakiye | numeric | Current balance |

---

#### **kasa_banka_hareketleri** (Cash & Bank Transactions)
Transaction log for accounts.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| hesap_id | uuid | FK to kasa_banka_hesaplari |
| tarih | date | Transaction date |
| tip | text | Type (giris, cikis) |
| tutar | numeric | Amount |
| aciklama | text | Description |

---

### Purchasing Tables

#### **satin_alma_talepleri** (Purchase Requests)
Purchase order management.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| talep_tarihi | date | Request date |
| talep_eden | text | Requester |
| durum | text | Status (beklemede, onaylandi, tamamlandi) |
| proje_id | uuid | FK to projeler |
| created_at | timestamp | Record creation |

---

#### **satin_alma_kalemleri** (Purchase Request Items)
Line items for purchase requests.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| talep_id | uuid | FK to satin_alma_talepleri |
| stok_kart_id | uuid | FK to stok_kartlari |
| miktar | numeric | Quantity requested |
| birim | text | Unit |
| aciklama | text | Notes |

---

### Cost Analysis

#### **maliyet_analizi** (migration 059)
Project cost tracking and analysis.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| proje_id | uuid | FK to projeler |
| donem | text | Period (YYYY-MM) |
| maliyet_detay | jsonb | Detailed cost breakdown |
| toplam_maliyet | numeric | Total cost |

---

#### **tedarikci_urun_mapping** (migration 095)
Supplier-product price mapping.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| tedarikci_id | uuid | FK to cariler |
| stok_kart_id | uuid | FK to stok_kartlari |
| tedarikci_urun_kodu | text | Supplier's product code |
| son_fiyat | numeric | Latest price |
| son_guncelleme | date | Last update date (migration 090) |

---

## Personel/HR Module

### Employee Management

#### **personeller**
Employee registry.

**Migration:** `20260128000006`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| ad_soyad | text | Full name |
| tc_kimlik_no | text | Turkish ID number (unique) |
| telefon | text | Phone |
| email | text | Email |
| departman | text | Department |
| pozisyon | text | Position |
| ise_giris_tarihi | date | Hire date |
| maas | numeric | Monthly salary |
| aktif | boolean | Active status |
| created_at | timestamp | Record creation |

---

### Project Assignments

#### **projeler**
Project registry and management.

**Migration:** `20260128000021`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| proje_adi | text | Project name |
| baslangic_tarihi | date | Start date |
| bitis_tarihi | date | End date |
| durum | text | Status (aktif, tamamlandi, iptal) |
| sozlesme_tutari | numeric | Contract amount |
| aktif | boolean | Soft delete flag |
| created_at | timestamp | Record creation |

---

#### **proje_personelleri** (Project Personnel Assignment)
Links employees to projects.

**Migration:** `20260128000021`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| proje_id | uuid | FK to projeler |
| personel_id | uuid | FK to personeller |
| atama_tarihi | date | Assignment date |
| cikis_tarihi | date | Release date (optional) |
| rol | text | Role in project |

---

### Payroll System

#### **bordro_kayitlari** (Payroll Records)
Monthly payroll calculations.

**Migration:** `20260128000022`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| personel_id | uuid | FK to personeller |
| yil | integer | Year |
| ay | integer | Month (1-12) |
| brut_ucret | numeric | Gross salary |
| sgk_isci | numeric | SSI employee deduction (14%) |
| sgk_isveren | numeric | SSI employer contribution (15.5%) |
| gelir_vergisi | numeric | Income tax |
| damga_vergisi | numeric | Stamp duty (0.759%) |
| net_ucret | numeric | Net salary |
| agi | numeric | AGI (family support) |
| created_at | timestamp | Record creation |

---

#### **vergi_dilimleri** (Tax Brackets)
Turkish income tax brackets by year.

**Migration:** `20260128000022`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| yil | integer | Tax year |
| alt_sinir | numeric | Lower bound |
| ust_sinir | numeric | Upper bound |
| oran | numeric | Tax rate (%) |

**2025/2026 Rates:**
- 0-110,000: 15%
- 110,000-230,000: 20%
- 230,000-870,000: 27%
- 870,000-3,000,000: 35%
- 3,000,000+: 40%

---

#### **asgari_ucret** (Minimum Wage)
Statutory minimum wage by year.

**Migration:** `20260128000022`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| yil | integer | Year |
| tutar | numeric | Monthly minimum wage |

**Historical:**
- 2024: 17,002 TL
- 2025: 22,104 TL
- 2026: 28,735 TL

---

### Leave and Severance

#### **izinler** (Leave Tracking)
Employee leave records.

**Migration:** `20260128000023`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| personel_id | uuid | FK to personeller |
| izin_tipi | text | Type (yillik, hastalik, etc.) |
| baslangic_tarihi | date | Start date |
| bitis_tarihi | date | End date |
| gun_sayisi | numeric | Number of days |
| durum | text | Status (onay_bekliyor, onaylandi, reddedildi) |

---

#### **kidem_tazminat** (Severance Calculation)
Severance payment tracking.

**Migration:** `20260128000023, 20260128000033`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| personel_id | uuid | FK to personeller |
| cikis_tarihi | date | Termination date |
| cikis_sebebi | text | Reason for termination |
| toplam_kidem | numeric | Total severance |
| hesaplama_detay | jsonb | Calculation breakdown |

---

### Payroll Templates and Accruals

- **bordro_templates** (migration 030) - Import templates for payroll data
- **bordro_tahakkuk** (migration 032) - Payroll accruals per project
- **maas_odeme** (migration 035) - Salary payment tracking

---

## Stok/Inventory Module

### Core Inventory Tables

#### **stok_kartlari** (Stock Cards)
Product master data.

**Migration:** `20260128000015` (major upgrade)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| urun_kodu | text | Product code (unique) |
| urun_adi | text | Product name |
| kategori_id | uuid | FK to stok_kategoriler |
| birim_id | uuid | FK to birimler |
| aciklama | text | Description |
| stok_miktari | numeric | Current stock quantity |
| min_stok | numeric | Minimum stock threshold |
| max_stok | numeric | Maximum stock level |
| birim_fiyat | numeric | Unit price |
| created_at | timestamp | Record creation |

---

#### **stok_hareketleri** (Stock Movements)
Inventory transaction log.

**Migration:** `20260128000015`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| stok_kart_id | uuid | FK to stok_kartlari |
| hareket_tipi | text | Type (giris, cikis, transfer, sayim) |
| hareket_yonu | text | Direction (artis, azalis) (migration 015) |
| miktar | numeric | Quantity |
| birim | text | Unit |
| tarih | date | Transaction date |
| aciklama | text | Description |
| depo_id | uuid | FK to depolar |
| belge_no | text | Document reference |

---

#### **birimler** (Units of Measure)
Standard units for inventory.

**Migration:** `20260128000015`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| birim_adi | text | Unit name (kg, adet, litre, etc.) |
| kisaltma | text | Abbreviation |
| birim_tipi | text | Type (agirlik, hacim, adet, etc.) |

---

#### **depolar** (Warehouses)
Warehouse/depot locations.

**Migration:** `20260128000015`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| depo_adi | text | Warehouse name |
| lokasyon | text | Physical location |
| aktif | boolean | Active status |

**KYK Depolar** (migration 016): Pre-seeded KYK warehouses

---

#### **stok_kategoriler** (Stock Categories)
Product categorization hierarchy.

**Migration:** `20260128000015`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| kategori_adi | text | Category name |
| ust_kategori_id | uuid | Parent category (self-referential) |

---

#### **stok_depo_durumlari** (Warehouse Stock Status)
Stock levels per warehouse.

**Migration:** `20260128000015`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| stok_kart_id | uuid | FK to stok_kartlari |
| depo_id | uuid | FK to depolar |
| miktar | numeric | Quantity in warehouse |
| son_guncelleme | timestamp | Last updated |

---

### Advanced Stock Features

- **stok_transfer** (migration 018) - Inter-warehouse transfers
- **akilli_stok_eslestirme** (migration 074) - Intelligent product matching
- **urun_kartlari** (migration 075, 076) - Advanced product cards
- **urun_varyantlari** (migration 079) - Product variants
- **birim_donusum_matrisi** (migration 080, 094) - Unit conversion matrix

---

## Reçete/Menu Module

### Recipe Management

#### **receteler** (Recipes)
Recipe master data.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| recete_adi | text | Recipe name |
| kategori_id | uuid | FK to recete_kategoriler |
| porsiyon_sayisi | integer | Number of servings |
| hazirlik_suresi | integer | Prep time (minutes) |
| aciklama | text | Description |
| proje_id | uuid | FK to projeler (migration 043) |
| created_at | timestamp | Record creation |

---

#### **recete_malzemeler** (Recipe Ingredients)
Ingredients for recipes.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| recete_id | uuid | FK to receteler |
| stok_kart_id | uuid | FK to stok_kartlari |
| miktar | numeric | Quantity |
| birim | text | Unit |
| maliyet | numeric | Ingredient cost (migration 062) |

---

#### **recete_kategoriler** (Recipe Categories)
Recipe classification.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| kategori_adi | text | Category name |
| ust_kategori_id | uuid | Parent category (migration 061) |

---

### Menu Planning

#### **menu_planlari** (Menu Plans)
Weekly/monthly menu schedules.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| plan_adi | text | Plan name |
| proje_id | uuid | FK to projeler |
| baslangic_tarihi | date | Start date |
| bitis_tarihi | date | End date |
| created_at | timestamp | Record creation |

---

#### **menu_plan_ogunleri** (Menu Plan Meals)
Daily meals in menu plan.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| menu_plan_id | uuid | FK to menu_planlari |
| tarih | date | Meal date |
| ogun_tipi_id | uuid | FK to ogun_tipleri |

---

#### **menu_ogun_yemekleri** (Menu Meal Dishes)
Recipes included in each meal.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| menu_plan_ogun_id | uuid | FK to menu_plan_ogunleri |
| recete_id | uuid | FK to receteler |
| porsiyon_sayisi | integer | Number of servings |

---

#### **ogun_tipleri** (Meal Types)
Standard meal categories.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| ogun_adi | text | Meal name (Kahvaltı, Öğle, Akşam, etc.) |
| sira | integer | Display order |

---

#### **proje_ogun_sablonlari** (Project Meal Templates)
Default meal configurations per project.

**Migration:** `20260128000039`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| proje_id | uuid | FK to projeler |
| ogun_tipi_id | uuid | FK to ogun_tipleri |
| varsayilan_porsiyon | integer | Default servings |

---

## System/Core Module

### Authentication & Authorization

#### **users**
User accounts for system access.

**Migration:** `20260128000001`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| email | text | Email (unique) |
| password_hash | text | bcrypt hashed password |
| ad_soyad | text | Full name |
| rol | text | Role (admin, user, etc.) |
| aktif | boolean | Account active status |
| last_login | timestamp | Last login time |
| created_at | timestamp | Account creation |

---

#### **refresh_tokens**
JWT refresh token storage.

**Migration:** `20260128000082`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| token_hash | text | Hashed refresh token |
| expires_at | timestamp | Token expiry (30 days) |
| revoked_at | timestamp | Revocation time |
| created_at | timestamp | Token creation |

---

#### **user_sessions**
Active session tracking for multi-device support.

**Migration:** `20260128000085, 20260128000098`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| refresh_token_id | uuid | FK to refresh_tokens |
| ip_address | text | Login IP |
| user_agent | text | Browser/device info |
| last_activity | timestamp | Last active time |
| created_at | timestamp | Session start |

---

#### **login_attempts**
Failed login tracking for account lockout.

**Migration:** `20260128000083`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| email | text | Login attempt email |
| ip_address | text | Source IP |
| success | boolean | Login success/failure |
| attempted_at | timestamp | Attempt time |
| user_id | uuid | FK to users (if successful) |

---

#### **account_lockout**
Temporary account locks after failed attempts.

**Migration:** `20260128000083`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| locked_until | timestamp | Lock expiry time |
| reason | text | Lock reason |
| created_at | timestamp | Lock creation |

---

#### **ip_access_control**
IP whitelist/blacklist rules.

**Migration:** `20260128000086, 20260128000100`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| ip_address | text | IP or CIDR range |
| rule_type | text | whitelist/blacklist |
| description | text | Rule description |
| aktif | boolean | Rule active status |
| created_by | uuid | FK to users |

---

### Permission System

#### **modules**
System module registry for RBAC.

**Migration:** `20260128000055`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| module_name | text | Module identifier (personel, fatura, etc.) |
| display_name | text | Display name |
| description | text | Module description |

---

#### **user_permissions**
User-specific permission grants.

**Migration:** `20260128000055`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| module_id | uuid | FK to modules |
| can_view | boolean | Read permission |
| can_create | boolean | Create permission |
| can_edit | boolean | Update permission |
| can_delete | boolean | Delete permission |

---

#### **permission_templates**
Pre-configured role templates.

**Migration:** `20260128000055`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| template_name | text | Template identifier |
| description | text | Template description |
| permissions | jsonb | Permission configuration |

**Pre-defined Templates:**
- `muhasebe` - Accounting full access
- `ihale_sorumlusu` - Tender manager
- `mutfak` - Kitchen/menu planning
- `satinalma` - Purchasing
- `ik` - HR/personnel

---

### Audit & Logging

#### **audit_logs**
System activity audit trail.

**Migration:** `20260128000055`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| action | text | Action performed |
| module | text | Module affected |
| record_id | uuid | Affected record ID |
| old_values | jsonb | Previous values |
| new_values | jsonb | New values |
| ip_address | text | Source IP |
| timestamp | timestamp | Action timestamp |

---

### Notifications

#### **notifications**
User notification system.

**Migration:** `20260128000050`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| title | text | Notification title |
| message | text | Notification body |
| type | text | Type (info, warning, error, success) |
| read | boolean | Read status |
| created_at | timestamp | Notification creation |

---

#### **admin_notifications**
System-wide admin alerts.

**Migration:** `20260128000084, 20260128000101`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| title | text | Alert title |
| message | text | Alert message |
| severity | text | Severity (info, warning, critical) |
| created_at | timestamp | Alert creation |

---

### Notes System

#### **notlar** (Notes)
Multi-purpose notes/tasks.

**Migration:** `20260128000047, 20260128000068` (enhanced)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| baslik | text | Note title |
| icerik | text | Note content |
| etiketler | text[] | Tags array |
| renk | text | Color coding |
| tip | text | Type (not, gorev, hatirlatma) |
| durum | text | Status (aktif, tamamlandi, iptal) |
| oncelik | text | Priority (dusuk, orta, yuksek) |
| bagli_modul | text | Related module |
| bagli_kayit_id | uuid | Related record ID |
| reminder_date | timestamp | Reminder timestamp |
| created_at | timestamp | Note creation |

**Enhanced Features (migration 068):**
- AI-generated notes support
- Hidden AI notes flag
- Rich text content
- Attachment references

---

### User Preferences

#### **user_preferences**
User-specific settings.

**Migration:** `20260128000081`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users (unique) |
| theme | text | UI theme preference |
| language | text | Language setting |
| preferences | jsonb | Additional settings |

---

### AI Integration

#### **ai_memory**
AI conversation history and context.

**Migration:** `20260128000010`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| conversation_id | uuid | Conversation group ID |
| role | text | Role (user, assistant, system) |
| content | text | Message content |
| metadata | jsonb | Additional context |
| created_at | timestamp | Message timestamp |

---

#### **ai_prompt_templates**
Saved AI prompt templates.

**Migration:** `20260128000045, 20260128000102` (improved)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| template_name | text | Template name |
| prompt_text | text | Template content |
| variables | jsonb | Template variables |
| category | text | Template category |
| model_name | text | Preferred AI model (migration 104) |

---

## Supporting Tables

### Fixed Assets

#### **demirbas_sistemi** (migration 024)
Fixed asset tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| demirbas_kodu | text | Asset code |
| demirbas_adi | text | Asset name |
| kategori | text | Category |
| lokasyon_id | uuid | Physical location |
| zimmetli_personel_id | uuid | FK to personeller |
| durum | text | Status (kulanimda, bakimda, hurda) |
| edinim_tarihi | date | Acquisition date |
| deger | numeric | Asset value |

---

### Market Pricing

#### **piyasa_fiyatlari** (migration 038)
Market price tracking from web scraping.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| urun_adi | text | Product name |
| market_adi | text | Market name |
| fiyat | numeric | Price |
| birim | text | Unit |
| tarih | date | Price date |
| url | text | Source URL |

---

### Product Catalog

#### **ana_urunler** (migration 063, 065)
Main product hierarchy.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| urun_adi | text | Product name |
| kategori | text | Category |
| ust_urun_id | uuid | Parent product (migration 065) |

---

### Synchronization

#### **sync_logs** (migration 005)
Data synchronization tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| sync_type | text | Sync operation type |
| status | text | Status (success, failure) |
| records_synced | integer | Record count |
| error_message | text | Error details |
| synced_at | timestamp | Sync timestamp |

---

### Settings & Configuration

#### **settings_versions** (migration 088)
Configuration version control.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| setting_key | text | Setting identifier |
| value | jsonb | Setting value |
| version | integer | Version number |
| changed_by | uuid | FK to users |
| changed_at | timestamp | Change timestamp |

---

## Migration History

### Timeline of Major Changes

| Period | Migrations | Key Features |
|--------|-----------|--------------|
| **Initial Setup** | 001-003 | Core schema, tenders, invoices, users |
| **Financial Core** | 004-007 | Invoice system, accounting tables |
| **Purchasing** | 008-009 | Satın alma, tags |
| **AI Integration** | 010 | AI memory system |
| **Duplicate Detection** | 011 | Duplicate checking |
| **Fixes** | 012-014 | Database issue fixes, trigger corrections |
| **Inventory Upgrade** | 015-020 | Major stok system overhaul, depot management |
| **Personnel** | 021-023 | Projects, payroll, leave, severance |
| **Fixed Assets** | 024-025 | Demirbaş tracking, locations |
| **Financial Tools** | 026-027 | Checks/bills, invoice matching |
| **Payroll Advanced** | 028-035 | Bordro templates, accruals, payments |
| **Project Integration** | 036-037 | Project transactions |
| **Market Pricing** | 038 | Market scraper integration |
| **Menu Planning** | 039-043 | Recipe system, menu plans, KYK recipes |
| **Tender Expansion** | 044, 049, 051, 054, 056-057, 072 | Proposals, results, tracking |
| **System Core** | 045-046, 050, 055 | AI settings, notifications, RBAC |
| **Enhanced Notes** | 047-048, 068, 073 | Notes with tags, AI notes |
| **Cost Analysis** | 059 | Maliyet tracking |
| **Recipe Pricing** | 061-062 | Recipe categories, ingredient costs |
| **Product Catalog** | 063-066, 075-076, 079 | Product hierarchy, cards, variants |
| **Fixes & Improvements** | 067, 074, 077-078, 080 | Scraper fixes, smart matching, WhatsApp |
| **Authentication** | 081-089 | Preferences, tokens, sessions, lockout, IP control |
| **Pricing Updates** | 090-096 | Price dates, invoice item matching, unit pricing |
| **Performance** | 097 | Performance indexes |
| **Admin Features** | 099-102 | God mode, notifications, AI templates |
| **Recent Updates** | 103-106 | Scraper queue, template models, deduplication, fixes |
| **Latest Enhancements** | 107-110 | (Check recent migration files) |

---

## Naming Inconsistencies

### Identified Issues

#### 1. **Turkish Plural Forms**
- ✓ Correct: `cariler`, `personeller`, `projeler`, `receteler`
- ✗ Inconsistent: `cari_hareketler` (should be `cariler_hareketler`?)

#### 2. **Underscore Usage**
- ✓ Correct: `stok_kartlari`, `kasa_banka_hesaplari`
- ✗ Inconsistent: `stokdepodurumlari` (missing underscores)

#### 3. **Foreign Key Naming**
- Variation 1: `stok_kart_id`
- Variation 2: `stok_kartlari_id`
- Recommendation: Standardize to singular table name + `_id`

#### 4. **Language Mixing**
- Turkish tables: `cariler`, `personeller`
- English tables: `users`, `documents`, `audit_logs`
- Recommendation: Decide on primary language or namespace separation

#### 5. **Soft Delete Columns**
- `aktif` (boolean) in some tables
- No standard `deleted_at` timestamp approach
- Recommendation: Global soft delete pattern with `deleted_at`

---

## Recommendations

### 1. **Naming Standardization**
Create migration to rename inconsistent tables:
- `stokdepodurumlari` → `stok_depo_durumlari`
- Standardize all foreign keys to `{table_name}_id`

### 2. **Soft Delete Pattern**
Add `deleted_at` timestamp to all critical tables:
```sql
ALTER TABLE table_name ADD COLUMN deleted_at TIMESTAMP;
CREATE INDEX idx_table_name_not_deleted ON table_name (id) WHERE deleted_at IS NULL;
```

### 3. **Missing Constraints**
Add foreign key constraints where missing:
- Ensure all `_id` columns have proper FK constraints
- Add check constraints for enums (durum, tip, etc.)

### 4. **Index Optimization**
Review and add indexes for:
- Frequently queried date ranges (`tarih`, `created_at`)
- Status fields used in WHERE clauses
- Foreign key columns

### 5. **Documentation**
- Add COMMENT ON TABLE/COLUMN for all tables
- Document enum values for status fields
- Create ER diagram

---

**Last Updated:** 2026-01-31
**Maintainer:** Development Team
