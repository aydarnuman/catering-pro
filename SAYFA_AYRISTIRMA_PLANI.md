# 🔧 SAYFA AYRIŞTIRMA PLANI - Stok/Fatura Modülleri

## ÖZET
Stok sayfasındaki (3,800+ satır) fatura işlemleri ayrı bir `/muhasebe/faturalar` sayfasına taşınacak. Stok sayfası sadeleştirilecek.

---

## MEVCUT DURUM

```
/muhasebe/stok/page.tsx (3,847 satır) - HER ŞEY BURADA:
├── Depo yönetimi
├── Ürün listesi  
├── Stok giriş/çıkış/transfer/sayım
├── Fatura listesi ← TAŞINACAK
├── Fatura kalem eşleştirme ← TAŞINACAK
├── Akıllı eşleştirme UI ← TAŞINACAK
└── Stoğa aktarma ← TAŞINACAK
```

---

## HEDEF YAPI

```
/muhasebe/faturalar/page.tsx (YENİ)
├── Gelen faturalar listesi (uyumsoft_invoices)
├── Fatura detay/kalemler
├── Ürün eşleştirme arayüzü
├── Stoğa aktarma butonu
├── Toplu işlem
└── İşlenmiş/Bekleyen filtresi

/muhasebe/stok/page.tsx (SADELEŞTİRİLMİŞ)
├── Depo seçimi
├── Ürün/stok listesi
├── Manuel giriş/çıkış
├── Transfer
├── Sayım
└── Hareketler
```

---

## ADIM 1: Faturalar Sayfası Oluştur

### Dosya: `/frontend/src/app/muhasebe/faturalar/page.tsx`

### Taşınacak State'ler (stok/page.tsx'den):
```typescript
const [faturalar, setFaturalar] = useState<any[]>([]);
const [faturaLoading, setFaturaLoading] = useState(false);
const [selectedFatura, setSelectedFatura] = useState<any>(null);
const [faturaKalemler, setFaturaKalemler] = useState<AkilliKalem[]>([]);
const [faturaGirisDepo, setFaturaGirisDepo] = useState<number | null>(null);
const [kalemEslestirme, setKalemEslestirme] = useState<{ [key: number]: number | null }>({});
const [faturaOzet, setFaturaOzet] = useState<AkilliKalemlerResponse['ozet'] | null>(null);
const [faturaInfo, setFaturaInfo] = useState<AkilliKalemlerResponse['fatura'] | null>(null);
const [topluIslemLoading, setTopluIslemLoading] = useState(false);
```

### Taşınacak Fonksiyonlar:
```typescript
loadFaturalar()
loadFaturaKalemler(ettn)
handleTopluFaturaIsle()
handleFiyatGuncelle()
handleYeniUrunOlustur()
handleFaturaStokGirisi()
```

### Taşınacak Modal:
- `faturaModalOpened` içindeki TÜM içerik (satır ~2800-3600 arası)

### Gerekli Import'lar:
```typescript
import { stokAPI, type AkilliKalem, type AkilliKalemlerResponse } from '@/lib/api/services/stok';
import { urunlerAPI } from '@/lib/api/services/urunler';
```

---

## ADIM 2: Stok Sayfasını Sadeleştir

### Silinecekler (stok/page.tsx'den):
1. Fatura ile ilgili TÜM state'ler (yukarıdaki liste)
2. Fatura ile ilgili TÜM fonksiyonlar
3. `faturaModalOpened` Modal'ı tamamen
4. Fatura ile ilgili useEffect'ler

### Kalacaklar:
- Depo yönetimi (depoModalOpened)
- Stok listesi ve filtreleme
- Transfer modalı (transferOpened)
- Stok giriş modalı (stokGirisModalOpened)
- Stok çıkış modalı (stokCikisModalOpened)
- Sayım modalı (sayimModalOpened)
- Hareketler modalı (hareketlerModalOpened)
- Yeni ürün modalı (opened)
- Ürün detay modalı (detayModalOpened)
- Ürün kartları modalı (urunKartlariModalOpened)

### Menü Güncelleme:
```typescript
// ESKİ:
<Menu.Item onClick={() => { setFaturaModalOpened(true); loadFaturalar(); }}>Stok Girişi</Menu.Item>

// YENİ:
<Menu.Item onClick={() => router.push('/muhasebe/faturalar')}>Faturadan Giriş</Menu.Item>
<Menu.Item onClick={() => setStokGirisModalOpened(true)}>Manuel Giriş</Menu.Item>
```

---

## ADIM 3: Sidebar Güncelle

### Dosya: `/frontend/src/components/Sidebar.tsx` veya ilgili navigasyon

### Eklenecek:
```typescript
{
  label: 'Faturalar',
  href: '/muhasebe/faturalar',
  icon: IconFileInvoice,
}
```

---

## DOSYA YAPISI

```
/frontend/src/app/muhasebe/
├── faturalar/
│   └── page.tsx          ← YENİ (800-1000 satır)
├── stok/
│   └── page.tsx          ← SADELEŞTİRİLMİŞ (2500-2800 satır)
└── ...
```

---

## CURSOR TALİMATLARI

### Prompt 1: Faturalar Sayfası Oluştur
```
GÖREV: /frontend/src/app/muhasebe/faturalar/page.tsx oluştur

ÖNCE OKU:
- /frontend/src/app/muhasebe/stok/page.tsx (satır 2800-3600 arası faturaModalOpened içeriği)

YAPILACAKLAR:
1. Yeni sayfa oluştur: /frontend/src/app/muhasebe/faturalar/page.tsx
2. stok/page.tsx'den fatura ile ilgili state'leri kopyala
3. stok/page.tsx'den fatura ile ilgili fonksiyonları kopyala
4. faturaModalOpened içeriğini ana sayfa içeriği olarak kullan (modal yerine sayfa)
5. Breadcrumbs ekle: Muhasebe > Faturalar

KURALLAR:
- ES Modules kullan
- Türkçe yorum yaz
- Mevcut API'leri değiştirme
- stokAPI ve urunlerAPI import et

TEST:
- npm run dev
- /muhasebe/faturalar sayfasına git
- Fatura listesi görünmeli
```

### Prompt 2: Stok Sayfasını Sadeleştir
```
GÖREV: /frontend/src/app/muhasebe/stok/page.tsx sadeleştir

ÖNCE OKU:
- /frontend/src/app/muhasebe/stok/page.tsx

YAPILACAKLAR:
1. Fatura ile ilgili TÜM state'leri sil (faturalar, faturaLoading, selectedFatura, faturaKalemler, kalemEslestirme, faturaOzet, faturaInfo, topluIslemLoading)
2. Fatura ile ilgili TÜM fonksiyonları sil (loadFaturalar, loadFaturaKalemler, handleTopluFaturaIsle, handleFiyatGuncelle, handleYeniUrunOlustur, handleFaturaStokGirisi)
3. faturaModalOpened Modal'ını tamamen sil
4. URL'deki fatura parametresi kontrolünü sil
5. Menüdeki "Stok Girişi" butonunu güncelle:
   - "Faturadan Giriş" → router.push('/muhasebe/faturalar')
   - "Manuel Giriş" → setStokGirisModalOpened(true)

KURALLAR:
- Diğer modal ve fonksiyonlara dokunma
- Import'ları temizle (kullanılmayan)

TEST:
- npm run dev
- /muhasebe/stok sayfası hatasız açılmalı
- Stok işlemleri menüsü çalışmalı
```

### Prompt 3: Navigasyon Güncelle
```
GÖREV: Sidebar'a Faturalar linki ekle

ÖNCE OKU:
- /frontend/src/components/Sidebar.tsx (veya AppShell.tsx)

YAPILACAKLAR:
1. Muhasebe altına "Faturalar" linki ekle
2. Icon: IconFileInvoice
3. href: /muhasebe/faturalar

TEST:
- Sidebar'da Faturalar linki görünmeli
- Tıklayınca /muhasebe/faturalar'a gitmeli
```

---

## ÖNEMLİ NOTLAR

1. **API'ler değişmiyor** - stokAPI ve urunlerAPI aynı kalacak
2. **Backend değişmiyor** - Sadece frontend refactor
3. **Fonksiyonellik aynı** - Sadece yer değişiyor
4. **Test et** - Her adımdan sonra npm run dev ile test et

---

## TAHMİNİ SÜRE

| Adım | Süre |
|------|------|
| Faturalar sayfası | 2-3 saat |
| Stok sadeleştirme | 1-2 saat |
| Navigasyon | 15 dk |
| Test | 30 dk |
| **TOPLAM** | **4-6 saat** |
