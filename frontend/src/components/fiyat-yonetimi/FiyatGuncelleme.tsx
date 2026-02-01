'use client';

import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Divider,
  Group,
  List,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconDatabase,
  IconPercentage,
  IconPlayerPlay,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconShoppingCart,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { API_BASE_URL } from '@/lib/config';

interface ScrapingLog {
  id: number;
  kaynak_kod: string;
  kaynak_ad: string;
  basarili: boolean;
  toplam_urun: number;
  guncellenen_urun: number;
  hata_mesaji: string | null;
  created_at: string;
}

interface MarketSonuc {
  market: string;
  urun: string;
  fiyat: number;
  birimFiyat: number;
  birimTipi: string;
}

interface MarketAramaSonuc {
  success: boolean;
  urun: string;
  birim: string;
  min: number;
  max: number;
  ortalama: number;
  medyan: number;
  toplam_sonuc: number;
  fiyatlar: MarketSonuc[];
}

interface Kategori {
  id: number;
  ad: string;
  kategori_id?: number;
  kategori_ad?: string;
  urun_sayisi?: number;
}

const ORNEK_TZOB = `[
  {"urun_adi": "Domates", "uretici_fiyat": 8.50, "market_fiyat": 14.00, "birim": "kg"},
  {"urun_adi": "Salatalık", "uretici_fiyat": 7.00, "market_fiyat": 12.00, "birim": "kg"}
]`;

const ORNEK_ESK = `[
  {"urun_adi": "Dana Kıyma", "fiyat": 350.00, "birim": "kg", "kdv_dahil": true},
  {"urun_adi": "Tavuk But", "fiyat": 95.00, "birim": "kg", "kdv_dahil": true}
]`;

const ORNEK_HAL = `[
  {"urun_adi": "Domates", "min_fiyat": 10.00, "max_fiyat": 16.00, "ortalama_fiyat": 13.00, "birim": "kg"}
]`;

const ISLEM_TIPLERI = [
  { value: 'yuzde_artir', label: 'Yüzde Artır (%)' },
  { value: 'yuzde_azalt', label: 'Yüzde Azalt (%)' },
  { value: 'sabit_ekle', label: 'Sabit Tutar Ekle' },
  { value: 'sabit_cikar', label: 'Sabit Tutar Çıkar' },
];

export function FiyatGuncelleme() {
  const { isAuthenticated } = useAuth();
  const [loglar, setLoglar] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [islemYapiliyor, setIslemYapiliyor] = useState(false);

  // Veri girişi
  const [seciliKaynak, setSeciliKaynak] = useState<string | null>('tzob');
  const [veriJson, setVeriJson] = useState('');
  const [halBolge, setHalBolge] = useState('istanbul');

  // Otomatik market scraping
  const [aramaMetni, setAramaMetni] = useState('');
  const [aramaSonuc, setAramaSonuc] = useState<MarketAramaSonuc | null>(null);
  const [aramaYapiliyor, setAramaYapiliyor] = useState(false);
  const [topluLimit, setTopluLimit] = useState<number>(20);
  const [topluSonuc, setTopluSonuc] = useState<any>(null);
  const [topluModalAcik, setTopluModalAcik] = useState(false);

  // Güncelleme ayarları
  const [guncellemeMode, setGuncellemeMode] = useState('eskimis');
  const [seciliKategori, setSeciliKategori] = useState<string | null>(null);
  const [kategoriler, setKategoriler] = useState<Kategori[]>([]);

  // Toplu İşlem (% güncelleme)
  const [topluKategoriId, setTopluKategoriId] = useState<string>('');
  const [islem, setIslem] = useState<string>('');
  const [deger, setDeger] = useState<number | ''>('');
  const [aciklama, setAciklama] = useState('');
  const [guncelleniyor, setGuncelleniyor] = useState(false);
  const [hesaplaniyor, setHesaplaniyor] = useState(false);
  const [hesaplamaIlerleme, setHesaplamaIlerleme] = useState(0);

  // Toplu AI Tahmini
  const [aiTahminiYapiliyor, setAiTahminiYapiliyor] = useState(false);
  const [aiTahminiLimit, setAiTahminiLimit] = useState<number>(50);
  const [aiTahminiSonuc, setAiTahminiSonuc] = useState<any>(null);
  const [aiTahminiModalAcik, setAiTahminiModalAcik] = useState(false);

  const fetchData = async () => {
    try {
      const [logRes, katRes, katRes2] = await Promise.all([
        fetch(`${API_BASE_URL}/api/fiyat-yonetimi/piyasa/loglar?limit=20`),
        fetch(`${API_BASE_URL}/api/urun-kategorileri`),
        fetch(`${API_BASE_URL}/api/fiyat-yonetimi/kategoriler`),
      ]);

      const logData = await logRes.json();
      const katData = await katRes.json();
      const katData2 = await katRes2.json();

      if (logData.success) setLoglar(logData.data);
      // Kategorileri birleştir
      const kats = katData.success ? katData.data : [];
      const kats2 = katData2.success ? katData2.data : [];
      setKategoriler([
        ...kats,
        ...kats2.filter((k: any) => !kats.find((k2: any) => k2.id === k.kategori_id)),
      ]);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // === MARKET SCRAPING ===
  const handleMarketArama = async () => {
    if (!aramaMetni.trim()) {
      notifications.show({ title: 'Hata', message: 'Lütfen bir ürün adı giriniz', color: 'red' });
      return;
    }

    setAramaYapiliyor(true);
    setAramaSonuc(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/fiyat-yonetimi/piyasa/market/ara?q=${encodeURIComponent(aramaMetni)}`
      );
      const data = await res.json();

      if (data.success && data.data) {
        setAramaSonuc(data.data);
        notifications.show({
          title: 'Başarılı',
          message: `${data.data.toplam_sonuc || 0} sonuç bulundu`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Sonuç Bulunamadı',
          message: data.data?.error || 'Fiyat bulunamadı',
          color: 'orange',
        });
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setAramaYapiliyor(false);
    }
  };

  const handleTopluMarketGuncelle = async () => {
    if (guncellemeMode === 'kategori' && !seciliKategori) {
      notifications.show({ title: 'Hata', message: 'Lütfen bir kategori seçin', color: 'red' });
      return;
    }

    setIslemYapiliyor(true);
    setTopluSonuc(null);

    try {
      const body: any = { limit: topluLimit, mode: guncellemeMode };
      if (guncellemeMode === 'kategori' && seciliKategori) {
        body.kategori_id = parseInt(seciliKategori, 10);
      }

      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/piyasa/market/toplu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        setTopluSonuc(data.data);
        setTopluModalAcik(true);
        notifications.show({ title: 'Tamamlandı', message: data.message, color: 'green' });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // === TOPLU % GÜNCELLEME ===
  const handleTopluGuncelle = async () => {
    if (!isAuthenticated || !islem || !deger) return;

    setGuncelleniyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/toplu/guncelle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori_id: topluKategoriId || null, islem, deger, aciklama }),
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({ title: 'Başarılı', message: data.message, color: 'green' });
        setTopluKategoriId('');
        setIslem('');
        setDeger('');
        setAciklama('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Güncelleme başarısız',
        color: 'red',
      });
    } finally {
      setGuncelleniyor(false);
    }
  };

  const handleYenidenHesapla = async () => {
    if (!isAuthenticated) return;

    setHesaplaniyor(true);
    setHesaplamaIlerleme(0);

    try {
      const interval = setInterval(() => {
        setHesaplamaIlerleme((prev) => Math.min(prev + 10, 90));
      }, 500);

      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/toplu/yeniden-hesapla`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      clearInterval(interval);
      setHesaplamaIlerleme(100);

      const data = await res.json();
      if (data.success) {
        notifications.show({ title: 'Tamamlandı', message: data.message, color: 'green' });
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      notifications.show({
        title: 'Hata',
        message: error instanceof Error ? error.message : 'Hesaplama başarısız',
        color: 'red',
      });
    } finally {
      setTimeout(() => {
        setHesaplaniyor(false);
        setHesaplamaIlerleme(0);
      }, 1000);
    }
  };

  // === MANUEL VERİ GİRİŞİ ===
  const handleVeriYukle = async () => {
    if (!veriJson.trim()) {
      notifications.show({ title: 'Hata', message: 'Lütfen JSON veri giriniz', color: 'red' });
      return;
    }

    let veri: unknown;
    try {
      veri = JSON.parse(veriJson);
    } catch {
      notifications.show({ title: 'Hata', message: 'Geçersiz JSON formatı', color: 'red' });
      return;
    }

    setIslemYapiliyor(true);
    try {
      const endpoint =
        seciliKaynak === 'hal'
          ? `${API_BASE_URL}/api/fiyat-yonetimi/piyasa/hal`
          : `${API_BASE_URL}/api/fiyat-yonetimi/piyasa/${seciliKaynak}`;

      const body = seciliKaynak === 'hal' ? { veri, bolge: halBolge } : { veri };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        notifications.show({ title: 'Başarılı', message: data.message, color: 'green' });
        setVeriJson('');
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setIslemYapiliyor(false);
    }
  };

  const handleGuvenHesapla = async () => {
    setIslemYapiliyor(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/piyasa/guven-hesapla`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        notifications.show({ title: 'Başarılı', message: data.message, color: 'green' });
        fetchData();
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setIslemYapiliyor(false);
    }
  };

  // === TOPLU AI TAHMİNİ ===
  const handleTopluAiTahmini = async () => {
    if (!isAuthenticated) {
      notifications.show({ title: 'Hata', message: 'Giriş yapmalısınız', color: 'red' });
      return;
    }

    setAiTahminiYapiliyor(true);
    setAiTahminiSonuc(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/fiyat-yonetimi/toplu/ai-tahmini`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: aiTahminiLimit }),
      });

      const data = await res.json();

      if (data.success) {
        setAiTahminiSonuc(data.data);
        setAiTahminiModalAcik(true);
        notifications.show({
          title: 'AI Tahmini Tamamlandı',
          message: `${data.data?.basarili || 0} ürün için fiyat tahmini yapıldı`,
          color: 'green',
        });
        fetchData();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Hata',
        message: error.message || 'AI tahmini başarısız',
        color: 'red',
      });
    } finally {
      setAiTahminiYapiliyor(false);
    }
  };

  const ornekVeriYukle = () => {
    switch (seciliKaynak) {
      case 'tzob':
        setVeriJson(ORNEK_TZOB);
        break;
      case 'esk':
        setVeriJson(ORNEK_ESK);
        break;
      case 'hal':
        setVeriJson(ORNEK_HAL);
        break;
    }
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader />
        <Text c="dimmed">Yükleniyor...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* OTOMATİK MARKET SCRAPING */}
      <Paper
        p="md"
        withBorder
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <ThemeIcon size="lg" variant="white" color="violet">
              <IconRobot size={20} />
            </ThemeIcon>
            <div>
              <Title order={4} c="white">
                Otomatik Piyasa Fiyatları
              </Title>
              <Text size="xs" c="white" opacity={0.8}>
                Migros, ŞOK, Trendyol'dan gerçek zamanlı fiyat çekme
              </Text>
            </div>
          </Group>
          <Badge color="white" variant="light" size="lg">
            <IconShoppingCart size={14} style={{ marginRight: 4 }} />3 Market
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {/* Tek Ürün Arama */}
          <Card padding="md">
            <Text size="sm" fw={500} mb="xs">
              Ürün Fiyat Araması
            </Text>
            <Group gap="xs">
              <TextInput
                placeholder="Örn: Domates, Dana Kıyma, Zeytinyağı..."
                value={aramaMetni}
                onChange={(e) => setAramaMetni(e.target.value)}
                style={{ flex: 1 }}
                onKeyDown={(e) => e.key === 'Enter' && handleMarketArama()}
              />
              <Button
                leftSection={<IconSearch size={16} />}
                onClick={handleMarketArama}
                loading={aramaYapiliyor}
              >
                Ara
              </Button>
            </Group>

            {aramaSonuc?.success && (
              <Card mt="sm" withBorder padding="xs" bg="gray.0">
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>
                    {aramaSonuc.urun}
                  </Text>
                  <Badge>{aramaSonuc.toplam_sonuc} sonuç</Badge>
                </Group>
                <SimpleGrid cols={3} spacing="xs">
                  <div>
                    <Text size="xs" c="dimmed">
                      Min
                    </Text>
                    <Text size="sm" fw={500} c="green">
                      ₺{aramaSonuc.min?.toFixed(2)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Ortalama
                    </Text>
                    <Text size="sm" fw={700} c="blue">
                      ₺{aramaSonuc.ortalama?.toFixed(2)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Max
                    </Text>
                    <Text size="sm" fw={500} c="red">
                      ₺{aramaSonuc.max?.toFixed(2)}
                    </Text>
                  </div>
                </SimpleGrid>
                <Text size="xs" c="dimmed" mt="xs">
                  Birim: {aramaSonuc.birim}
                </Text>
              </Card>
            )}
          </Card>

          {/* Toplu Market Güncelleme */}
          <Card padding="md">
            <Text size="sm" fw={500} mb="xs">
              Toplu Piyasa Güncelleme
            </Text>
            <Stack gap="xs">
              <Select
                label="Güncelleme Modu"
                value={guncellemeMode}
                onChange={(v) => setGuncellemeMode(v || 'eskimis')}
                data={[
                  { value: 'eskimis', label: 'Sadece Eskimiş Fiyatlar (30+ gün)' },
                  { value: 'fiyatsiz', label: 'Fiyatı Olmayan Ürünler' },
                  { value: 'kategori', label: 'Kategori Seç' },
                  { value: 'hepsi', label: 'TÜM ÜRÜNLER (Dikkat!)' },
                ]}
                size="xs"
              />

              {guncellemeMode === 'kategori' && (
                <Select
                  label="Kategori"
                  placeholder="Kategori seçin..."
                  value={seciliKategori}
                  onChange={setSeciliKategori}
                  data={kategoriler.map((k) => ({
                    value: String(k.id || k.kategori_id),
                    label: k.ad || k.kategori_ad || '',
                  }))}
                  searchable
                  size="xs"
                />
              )}

              <Group gap="xs" align="end">
                <NumberInput
                  value={topluLimit}
                  onChange={(v) => setTopluLimit(Number(v) || 10)}
                  min={1}
                  max={200}
                  label="Maks ürün"
                  size="xs"
                  style={{ width: 100 }}
                />
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={handleTopluMarketGuncelle}
                  loading={islemYapiliyor}
                  color="green"
                  size="xs"
                >
                  Başlat
                </Button>
              </Group>
            </Stack>
            <Alert color="yellow" mt="sm" p="xs">
              <Text size="xs">
                Her ürün ~3sn sürer. {topluLimit} ürün ≈ {Math.ceil((topluLimit * 3) / 60)} dk
              </Text>
            </Alert>
          </Card>
        </SimpleGrid>
      </Paper>

      {/* TOPLU İŞLEMLER ACCORDION */}
      <Accordion variant="contained">
        <Accordion.Item value="toplu-islem">
          <Accordion.Control icon={<IconPercentage size={18} />}>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Toplu Fiyat İşlemleri
              </Text>
              <Badge size="xs" variant="light" color="blue">
                % Güncelleme & Yeniden Hesapla
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {/* Toplu % Güncelleme */}
              <Paper p="md" withBorder>
                <Text fw={500} mb="md">
                  Kategori Bazlı Güncelleme
                </Text>
                <Stack gap="sm">
                  <Select
                    label="Kategori"
                    placeholder="Tüm kategoriler"
                    data={[
                      { value: '', label: 'Tüm Kategoriler' },
                      ...kategoriler.map((k) => ({
                        value: (k.id || k.kategori_id || '').toString(),
                        label: `${k.ad || k.kategori_ad} ${k.urun_sayisi ? `(${k.urun_sayisi} ürün)` : ''}`,
                      })),
                    ]}
                    value={topluKategoriId}
                    onChange={(v) => setTopluKategoriId(v || '')}
                    clearable
                    size="sm"
                  />
                  <Select
                    label="İşlem"
                    placeholder="Seçin"
                    data={ISLEM_TIPLERI}
                    value={islem}
                    onChange={(v) => setIslem(v || '')}
                    required
                    size="sm"
                  />
                  <NumberInput
                    label={islem?.includes('yuzde') ? 'Yüzde (%)' : 'Tutar (TL)'}
                    placeholder="0"
                    value={deger}
                    onChange={(v) => setDeger(v as number)}
                    min={0}
                    max={islem?.includes('yuzde') ? 100 : undefined}
                    required
                    size="sm"
                  />
                  <Textarea
                    label="Açıklama"
                    placeholder="Güncelleme sebebi..."
                    value={aciklama}
                    onChange={(e) => setAciklama(e.target.value)}
                    rows={2}
                    size="sm"
                  />
                  <Button
                    onClick={handleTopluGuncelle}
                    loading={guncelleniyor}
                    disabled={!islem || !deger}
                    fullWidth
                  >
                    Güncelle
                  </Button>
                </Stack>
              </Paper>

              {/* Yeniden Hesaplama */}
              <Paper p="md" withBorder>
                <Text fw={500} mb="md">
                  Fiyatları Yeniden Hesapla
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Tüm ürünlerin aktif fiyatını öncelik sırasına göre yeniden hesaplar. Tedarikçi
                  sözleşmeleri, son faturalar ve piyasa verileri kontrol edilir.
                </Text>
                <Button
                  variant="outline"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleYenidenHesapla}
                  loading={hesaplaniyor}
                  fullWidth
                >
                  Tüm Fiyatları Yeniden Hesapla
                </Button>
                {hesaplaniyor && <Progress value={hesaplamaIlerleme} mt="md" size="sm" animated />}

                <Divider my="md" />

                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleGuvenHesapla}
                  loading={islemYapiliyor}
                  fullWidth
                >
                  Güven Skorlarını Hesapla
                </Button>

                <Divider my="md" label="AI Fiyat Tahmini" labelPosition="center" />

                <Text size="sm" c="dimmed" mb="sm">
                  Fiyatı olmayan ürünler için Claude AI ile toptan piyasa fiyat tahmini yapar.
                </Text>

                <Group gap="xs" mb="sm">
                  <NumberInput
                    value={aiTahminiLimit}
                    onChange={(v) => setAiTahminiLimit(Number(v) || 50)}
                    min={1}
                    max={200}
                    size="xs"
                    label="Maks ürün"
                    style={{ width: 100 }}
                  />
                  <Button
                    variant="gradient"
                    gradient={{ from: 'violet', to: 'blue' }}
                    leftSection={<IconRobot size={16} />}
                    onClick={handleTopluAiTahmini}
                    loading={aiTahminiYapiliyor}
                    size="xs"
                    style={{ marginTop: 'auto' }}
                  >
                    Toplu AI Tahmini
                  </Button>
                </Group>

                <Alert icon={<IconAlertCircle size={16} />} color="yellow" mt="md">
                  <Text size="xs">
                    Toplu güncelleme işlemleri geri alınamaz. Kategori seçmezseniz TÜM ürünler
                    etkilenir.
                  </Text>
                </Alert>
              </Paper>
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="gelismis">
          <Accordion.Control icon={<IconDatabase size={18} />}>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Gelişmiş Ayarlar
              </Text>
              <Badge size="xs" variant="light" color="gray">
                Manuel Veri Girişi
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Divider label="Manuel Veri Girişi (TZOB/ESK/HAL)" labelPosition="center" />

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Stack gap="xs">
                  <Group>
                    <Select
                      size="xs"
                      label="Kaynak"
                      value={seciliKaynak}
                      onChange={setSeciliKaynak}
                      data={[
                        { value: 'tzob', label: 'TZOB - Ziraat Odaları' },
                        { value: 'esk', label: 'ESK - Et ve Süt Kurumu' },
                        { value: 'hal', label: 'HAL - Toptancı Hali' },
                      ]}
                      style={{ flex: 1 }}
                    />
                    {seciliKaynak === 'hal' && (
                      <Select
                        size="xs"
                        label="Bölge"
                        value={halBolge}
                        onChange={(v) => setHalBolge(v || 'istanbul')}
                        data={[
                          { value: 'istanbul', label: 'İstanbul' },
                          { value: 'ankara', label: 'Ankara' },
                          { value: 'izmir', label: 'İzmir' },
                        ]}
                        style={{ width: 120 }}
                      />
                    )}
                  </Group>
                  <Textarea
                    placeholder="JSON veri yapıştırın..."
                    value={veriJson}
                    onChange={(e) => setVeriJson(e.target.value)}
                    minRows={4}
                    styles={{ input: { fontFamily: 'monospace', fontSize: 11 } }}
                  />
                  <Group>
                    <Button
                      size="xs"
                      leftSection={<IconUpload size={14} />}
                      onClick={handleVeriYukle}
                      loading={islemYapiliyor}
                    >
                      Yükle
                    </Button>
                    <Button size="xs" variant="light" onClick={ornekVeriYukle}>
                      Örnek
                    </Button>
                  </Group>
                </Stack>
                <Code block style={{ fontSize: 10 }}>
                  {`// TZOB: 
[{"urun_adi": "Domates", "market_fiyat": 14, "birim": "kg"}]

// ESK:
[{"urun_adi": "Dana Kıyma", "fiyat": 350, "birim": "kg"}]

// HAL:
[{"urun_adi": "Domates", "ortalama_fiyat": 13, "birim": "kg"}]`}
                </Code>
              </SimpleGrid>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Son İşlem Logları */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={4}>Son İşlem Logları</Title>
          <ActionIcon variant="subtle" onClick={fetchData}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {loglar.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">
            Henüz işlem kaydı yok
          </Text>
        ) : (
          <Timeline active={0} bulletSize={24} lineWidth={2}>
            {loglar.slice(0, 10).map((log) => (
              <Timeline.Item
                key={log.id}
                bullet={log.basarili ? <IconCheck size={14} /> : <IconX size={14} />}
                color={log.basarili ? 'green' : 'red'}
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {log.kaynak_ad}
                    </Text>
                    <Badge size="xs" color={log.basarili ? 'green' : 'red'}>
                      {log.guncellenen_urun}/{log.toplam_urun}
                    </Badge>
                  </Group>
                }
              >
                <Text size="xs" c="dimmed">
                  {new Date(log.created_at).toLocaleString('tr-TR')}
                </Text>
                {log.hata_mesaji && (
                  <Text size="xs" c="red">
                    {log.hata_mesaji}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Paper>

      {/* Toplu Sonuç Modal */}
      <Modal
        opened={topluModalAcik}
        onClose={() => setTopluModalAcik(false)}
        title="Toplu Güncelleme Sonucu"
        size="lg"
      >
        {topluSonuc && (
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <Card withBorder padding="md" bg="green.0">
                <Text size="xl" fw={700} c="green">
                  {topluSonuc.basarili}
                </Text>
                <Text size="sm" c="dimmed">
                  Başarılı
                </Text>
              </Card>
              <Card withBorder padding="md" bg="red.0">
                <Text size="xl" fw={700} c="red">
                  {topluSonuc.hatali}
                </Text>
                <Text size="sm" c="dimmed">
                  Başarısız
                </Text>
              </Card>
            </SimpleGrid>

            {topluSonuc.detaylar && topluSonuc.detaylar.length > 0 && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Detaylar:
                </Text>
                <List size="sm" spacing="xs">
                  {topluSonuc.detaylar.map((d: any, i: number) => (
                    <List.Item
                      key={i}
                      icon={
                        d.durum === 'basarili' ? (
                          <ThemeIcon color="green" size={20} radius="xl">
                            <IconCheck size={12} />
                          </ThemeIcon>
                        ) : (
                          <ThemeIcon color="red" size={20} radius="xl">
                            <IconX size={12} />
                          </ThemeIcon>
                        )
                      }
                    >
                      <Text size="sm">
                        {d.ad}
                        {d.fiyat && (
                          <Text span c="green" fw={500}>
                            {' '}
                            - ₺{d.fiyat.toFixed(2)}
                          </Text>
                        )}
                        {d.durum === 'bulunamadi' && (
                          <Text span c="dimmed">
                            {' '}
                            (fiyat bulunamadı)
                          </Text>
                        )}
                        {d.hata && (
                          <Text span c="red">
                            {' '}
                            ({d.hata})
                          </Text>
                        )}
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </div>
            )}

            <Button onClick={() => setTopluModalAcik(false)} fullWidth>
              Kapat
            </Button>
          </Stack>
        )}
      </Modal>

      {/* AI Tahmini Sonuç Modal */}
      <Modal
        opened={aiTahminiModalAcik}
        onClose={() => setAiTahminiModalAcik(false)}
        title={
          <Group gap="xs">
            <ThemeIcon color="violet" size="lg">
              <IconRobot size={18} />
            </ThemeIcon>
            <Text fw={600}>AI Fiyat Tahmini Sonucu</Text>
          </Group>
        }
        size="lg"
      >
        {aiTahminiSonuc && (
          <Stack gap="md">
            <SimpleGrid cols={2}>
              <Card withBorder padding="md" bg="green.0">
                <Text size="xl" fw={700} c="green">
                  {aiTahminiSonuc.basarili}
                </Text>
                <Text size="sm" c="dimmed">
                  Başarılı Tahmin
                </Text>
              </Card>
              <Card withBorder padding="md" bg="red.0">
                <Text size="xl" fw={700} c="red">
                  {aiTahminiSonuc.hatali}
                </Text>
                <Text size="sm" c="dimmed">
                  Tahmin Edilemedi
                </Text>
              </Card>
            </SimpleGrid>

            {aiTahminiSonuc.message && (
              <Alert color="blue" icon={<IconRobot size={16} />}>
                <Text size="sm">{aiTahminiSonuc.message}</Text>
              </Alert>
            )}

            {aiTahminiSonuc.detaylar && aiTahminiSonuc.detaylar.length > 0 && (
              <div>
                <Text size="sm" fw={500} mb="xs">
                  Tahmin Edilen Fiyatlar:
                </Text>
                <Paper withBorder p="xs" style={{ maxHeight: 300, overflow: 'auto' }}>
                  <List size="sm" spacing="xs">
                    {aiTahminiSonuc.detaylar.map((d: any, i: number) => (
                      <List.Item
                        key={i}
                        icon={
                          <ThemeIcon color="violet" size={20} radius="xl">
                            <IconRobot size={12} />
                          </ThemeIcon>
                        }
                      >
                        <Group gap="xs">
                          <Text size="sm" style={{ flex: 1 }}>
                            {d.ad || `Ürün #${d.urun_id}`}
                          </Text>
                          <Badge color="green" variant="light">
                            ₺{d.fiyat?.toFixed(2)}
                          </Badge>
                          <Badge color="gray" size="xs">
                            %{d.guven} güven
                          </Badge>
                        </Group>
                        {d.aciklama && (
                          <Text size="xs" c="dimmed" mt={2}>
                            {d.aciklama}
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </Paper>
              </div>
            )}

            <Button onClick={() => setAiTahminiModalAcik(false)} fullWidth>
              Kapat
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
