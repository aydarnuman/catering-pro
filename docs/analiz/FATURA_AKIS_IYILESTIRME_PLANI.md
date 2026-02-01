# Fatura Modülü Akış İyileştirme Planı

## Mevcut Durum Analizi

### Problem Özeti
Şu anki fatura-stok akışı **12 adım** gerektiriyor, bu **3-4 adıma** indirilebilir.

### Mevcut Akış (12 Adım)
```
1. Faturalar listesi → 2. Fatura detay → 3. Kalemleri Gör butonu →
4. Kalemler sayfası → 5. Her kalem için eşleştirme → 6. Geri dön →
7. Stoğa İşle butonu → 8. Depo seç → 9. Kalemleri seç →
10. Birim kontrol → 11. Onayla → 12. Sonuç
```

### Hedef Akış (4 Adım)
```
1. Faturalar listesi → 2. Kalemler sayfası (detay ile birleşik) →
3. Eşleştir + Depo Seç → 4. Stoğa İşle (aynı sayfada)
```

---

## İyileştirme 1: Kalemler Sayfasına "Stoğa İşle" Butonu

### Amaç
Kullanıcı eşleştirmeyi bitirdikten sonra geri dönmeden doğrudan stoğa işleyebilsin.

### Değişiklikler

#### Frontend: `/frontend/src/app/muhasebe/faturalar/[ettn]/kalemler/page.tsx`

**1. State Eklemeleri (mevcut state'lerin yanına)**
```typescript
// Stoğa işleme için state'ler
const [stokModalAcik, setStokModalAcik] = useState(false);
const [secilenDepo, setSecilenDepo] = useState<number | null>(null);
const [secilenKalemler, setSecilenKalemler] = useState<number[]>([]);
const [depolar, setDepolar] = useState<any[]>([]);
const [stokIslemleniyor, setStokIslemleniyor] = useState(false);
```

**2. Depo Listesi Çekme (useEffect içine)**
```typescript
// Depoları çek
const fetchDepolar = async () => {
  try {
    const response = await depolarAPI.listele();
    setDepolar(response);
  } catch (error) {
    console.error('Depolar yüklenemedi:', error);
  }
};

useEffect(() => {
  fetchDepolar();
}, []);
```

**3. Stoğa İşle Fonksiyonu**
```typescript
const stogaIsle = async () => {
  if (!secilenDepo) {
    notifications.show({
      title: 'Hata',
      message: 'Lütfen bir depo seçin',
      color: 'red'
    });
    return;
  }

  // Sadece eşleşmiş kalemleri filtrele
  const islenecekKalemler = kalemler
    .filter(k => k.urun_id && secilenKalemler.includes(k.sira))
    .map(k => ({
      urun_id: k.urun_id,
      miktar: k.miktar,
      birim: k.birim,
      birim_carpani: k.birim_carpani || 1,
      birim_fiyat: k.birim_fiyat
    }));

  if (islenecekKalemler.length === 0) {
    notifications.show({
      title: 'Uyarı',
      message: 'İşlenecek eşleşmiş kalem bulunamadı',
      color: 'yellow'
    });
    return;
  }

  setStokIslemleniyor(true);
  try {
    await stokAPI.faturadanGiris({
      ettn: params.ettn,
      depo_id: secilenDepo,
      kalemler: islenecekKalemler
    });

    notifications.show({
      title: 'Başarılı',
      message: `${islenecekKalemler.length} kalem stoğa işlendi`,
      color: 'green'
    });

    setStokModalAcik(false);
    // Sayfayı yenile veya durumu güncelle
    fetchKalemler();
  } catch (error: any) {
    notifications.show({
      title: 'Hata',
      message: error.message || 'Stok işleme başarısız',
      color: 'red'
    });
  } finally {
    setStokIslemleniyor(false);
  }
};
```

**4. UI Değişiklikleri - Header'a Buton Ekleme**
```tsx
// Mevcut "Geri" butonunun yanına
<Group>
  <Button
    variant="outline"
    leftSection={<IconArrowLeft size={16} />}
    onClick={() => router.push('/muhasebe/faturalar')}
  >
    Geri
  </Button>

  {/* YENİ: Stoğa İşle butonu */}
  <Button
    color="green"
    leftSection={<IconPackageImport size={16} />}
    onClick={() => {
      // Eşleşmiş kalemleri otomatik seç
      const eslesmiKalemler = kalemler
        .filter(k => k.urun_id)
        .map(k => k.sira);
      setSecilenKalemler(eslesmiKalemler);
      setStokModalAcik(true);
    }}
    disabled={kalemler.filter(k => k.urun_id).length === 0}
  >
    Stoğa İşle ({kalemler.filter(k => k.urun_id).length} kalem)
  </Button>
</Group>
```

**5. Stok Modal Componenti**
```tsx
<Modal
  opened={stokModalAcik}
  onClose={() => setStokModalAcik(false)}
  title="Stoğa İşle"
  size="lg"
>
  <Stack>
    {/* Depo Seçimi */}
    <Select
      label="Hedef Depo"
      placeholder="Depo seçin"
      data={depolar.map(d => ({ value: d.id.toString(), label: d.ad }))}
      value={secilenDepo?.toString()}
      onChange={(val) => setSecilenDepo(val ? parseInt(val) : null)}
      required
    />

    {/* Kalem Listesi */}
    <Text size="sm" fw={500}>İşlenecek Kalemler ({secilenKalemler.length})</Text>
    <ScrollArea h={300}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <Checkbox
                checked={secilenKalemler.length === kalemler.filter(k => k.urun_id).length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSecilenKalemler(kalemler.filter(k => k.urun_id).map(k => k.sira));
                  } else {
                    setSecilenKalemler([]);
                  }
                }}
              />
            </Table.Th>
            <Table.Th>Ürün</Table.Th>
            <Table.Th>Miktar</Table.Th>
            <Table.Th>Birim</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {kalemler.filter(k => k.urun_id).map(kalem => (
            <Table.Tr key={kalem.sira}>
              <Table.Td>
                <Checkbox
                  checked={secilenKalemler.includes(kalem.sira)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSecilenKalemler([...secilenKalemler, kalem.sira]);
                    } else {
                      setSecilenKalemler(secilenKalemler.filter(s => s !== kalem.sira));
                    }
                  }}
                />
              </Table.Td>
              <Table.Td>{kalem.urun_adi || kalem.aciklama}</Table.Td>
              <Table.Td>{kalem.miktar}</Table.Td>
              <Table.Td>{kalem.birim}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>

    {/* Onay Butonu */}
    <Group justify="flex-end">
      <Button variant="outline" onClick={() => setStokModalAcik(false)}>
        İptal
      </Button>
      <Button
        color="green"
        onClick={stogaIsle}
        loading={stokIslemleniyor}
        disabled={!secilenDepo || secilenKalemler.length === 0}
      >
        {secilenKalemler.length} Kalemi Stoğa İşle
      </Button>
    </Group>
  </Stack>
</Modal>
```

---

## İyileştirme 2: İlerleme Göstergesi

### Amaç
Kullanıcı kaç kalemin eşleştiğini hızlıca görsün.

### Değişiklikler

**Header'a Progress Bar Ekleme**
```tsx
// Sayfa başlığının altına
const eslesmisCount = kalemler.filter(k => k.urun_id).length;
const toplamCount = kalemler.length;
const yuzde = toplamCount > 0 ? (eslesmisCount / toplamCount) * 100 : 0;

<Paper p="md" mb="md" withBorder>
  <Group justify="space-between" mb="xs">
    <Text size="sm">Eşleştirme Durumu</Text>
    <Text size="sm" fw={500} c={yuzde === 100 ? 'green' : 'blue'}>
      {eslesmisCount} / {toplamCount} kalem eşleşti
    </Text>
  </Group>
  <Progress
    value={yuzde}
    color={yuzde === 100 ? 'green' : 'blue'}
    size="lg"
    radius="xl"
  />
  {yuzde === 100 && (
    <Text size="xs" c="green" mt="xs">
      ✓ Tüm kalemler eşleşti! Stoğa işlemeye hazır.
    </Text>
  )}
</Paper>
```

---

## İyileştirme 3: Varsayılan Depo Hatırlama

### Amaç
Kullanıcının her seferinde depo seçmesine gerek kalmasın.

### Değişiklikler

**LocalStorage ile Depo Hatırlama**
```typescript
// Depo seçildiğinde kaydet
const handleDepoSecimi = (depoId: number) => {
  setSecilenDepo(depoId);
  localStorage.setItem('varsayilan_depo', depoId.toString());
};

// Sayfa yüklendiğinde oku
useEffect(() => {
  const varsayilanDepo = localStorage.getItem('varsayilan_depo');
  if (varsayilanDepo) {
    setSecilenDepo(parseInt(varsayilanDepo));
  }
}, []);
```

---

## İyileştirme 4: Otomatik Eşleştirme İyileştirmesi

### Mevcut Durum
Otomatik eşleştirme var ama sonuç hakkında yeterli bilgi vermiyor.

### Değişiklikler

**Detaylı Sonuç Gösterimi**
```typescript
const otomatikEslesdir = async () => {
  setOtoEslestirmeYukleniyor(true);
  try {
    const sonuc = await faturaKalemleriAPI.otomatikEslesdir(params.ettn);

    // Detaylı sonuç göster
    notifications.show({
      title: 'Otomatik Eşleştirme Tamamlandı',
      message: (
        <Stack gap="xs">
          <Text size="sm">✓ Eşleşen: {sonuc.eslesen} kalem</Text>
          <Text size="sm">⚠ Eşleşmeyen: {sonuc.eslesmeyen} kalem</Text>
          {sonuc.eslesmeyen > 0 && (
            <Text size="xs" c="dimmed">
              Eşleşmeyen kalemler için manuel eşleştirme yapın
            </Text>
          )}
        </Stack>
      ),
      color: sonuc.eslesmeyen === 0 ? 'green' : 'yellow',
      autoClose: 5000
    });

    fetchKalemler();
  } catch (error) {
    notifications.show({
      title: 'Hata',
      message: 'Otomatik eşleştirme başarısız',
      color: 'red'
    });
  } finally {
    setOtoEslestirmeYukleniyor(false);
  }
};
```

---

## İyileştirme 5: Fatura Listesinde Durum Göstergesi

### Amaç
Fatura listesinde hangi faturaların işlendiği, eşleştirildiği görülsün.

### Değişiklikler

#### Frontend: `/frontend/src/app/muhasebe/faturalar/page.tsx`

**Durum Badge'leri**
```tsx
// Tablo kolonuna ekle
<Table.Td>
  <Group gap="xs">
    {fatura.stok_islendi ? (
      <Badge color="green" size="sm">Stoğa İşlendi</Badge>
    ) : fatura.eslesme_orani === 100 ? (
      <Badge color="blue" size="sm">Eşleşti</Badge>
    ) : fatura.eslesme_orani > 0 ? (
      <Badge color="yellow" size="sm">%{fatura.eslesme_orani} Eşleşti</Badge>
    ) : (
      <Badge color="gray" size="sm">Bekliyor</Badge>
    )}
  </Group>
</Table.Td>
```

#### Backend: Eşleşme oranı hesaplama

**`/backend/src/routes/faturalar.js` - Listeleme endpoint'ine ekle**
```javascript
// Fatura listelerken eşleşme oranını da hesapla
const faturaListesiSorgusu = `
  SELECT
    f.*,
    COALESCE(
      (SELECT COUNT(*) FILTER (WHERE urun_id IS NOT NULL) * 100 / NULLIF(COUNT(*), 0)
       FROM fatura_kalemleri fk
       WHERE fk.ettn = f.ettn),
      0
    ) as eslesme_orani,
    EXISTS(
      SELECT 1 FROM fatura_stok_islem fsi WHERE fsi.ettn = f.ettn
    ) as stok_islendi
  FROM invoices f
  ORDER BY f.fatura_tarihi DESC
`;
```

---

## Uygulama Önceliği

| Sıra | İyileştirme | Etki | Zorluk |
|------|-------------|------|--------|
| 1 | Stoğa İşle Butonu | Yüksek | Orta |
| 2 | İlerleme Göstergesi | Orta | Düşük |
| 3 | Varsayılan Depo | Orta | Düşük |
| 4 | Otomatik Eşleştirme | Düşük | Düşük |
| 5 | Liste Durum Göstergesi | Orta | Orta |

---

## Tahmini Dosya Değişiklikleri

1. **`/frontend/src/app/muhasebe/faturalar/[ettn]/kalemler/page.tsx`**
   - Stoğa işle modal ve fonksiyonları
   - İlerleme göstergesi
   - Varsayılan depo hatırlama

2. **`/frontend/src/app/muhasebe/faturalar/page.tsx`**
   - Durum badge'leri

3. **`/backend/src/routes/faturalar.js`**
   - Eşleşme oranı hesaplama

4. **`/frontend/src/lib/api/index.ts`** (gerekirse)
   - Yeni API fonksiyonları

---

## Notlar

- Stoğa işleme **manuel kalmalı** çünkü bir faturada farklı birimlerin ürünleri olabiliyor
- Eşleştirme **zorunlu** çünkü menü maliyeti hesabı için gerekli
- `birim_carpani` hesaplaması mevcut sistemde doğru çalışıyor
- Çift stok işleme koruması `fatura_stok_islem` tablosunda mevcut
