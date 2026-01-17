'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Box,
  Table,
  ActionIcon,
  TextInput,
  Modal,
  Drawer,
  Paper,
  ThemeIcon,
  ScrollArea,
  SimpleGrid,
  Center,
  Loader,
  Transition,
  Select
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconRobot,
  IconSearch,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconSend,
  IconCheck,
  IconSparkles,
  IconChevronRight,
  IconMessageCircle,
  IconDownload,
  IconShoppingCart,
  IconChartBar,
  IconX
} from '@tabler/icons-react';

const API_URL = `${API_BASE_URL}/api`;

// Market Logoları - Özel tasarım
const MARKET_INFO: Record<string, { letter: string; color: string; gradient: string }> = {
  'Migros': {
    letter: 'M',
    color: '#FF6600',
    gradient: 'linear-gradient(135deg, #FF6600 0%, #FF8533 100%)'
  },
  'ŞOK': {
    letter: 'Ş',
    color: '#E31837',
    gradient: 'linear-gradient(135deg, #E31837 0%, #FF4757 100%)'
  },
  'Trendyol': {
    letter: 'T',
    color: '#F27A1A',
    gradient: 'linear-gradient(135deg, #F27A1A 0%, #FF9F43 100%)'
  },
  'A101': {
    letter: 'A',
    color: '#003DA5',
    gradient: 'linear-gradient(135deg, #003DA5 0%, #0066CC 100%)'
  },
  'CarrefourSA': {
    letter: 'C',
    color: '#004B91',
    gradient: 'linear-gradient(135deg, #004B91 0%, #0066CC 100%)'
  },
  'Getir': {
    letter: 'G',
    color: '#5D3EBC',
    gradient: 'linear-gradient(135deg, #5D3EBC 0%, #8B5CF6 100%)'
  },
  'BİM': {
    letter: 'B',
    color: '#C8102E',
    gradient: 'linear-gradient(135deg, #C8102E 0%, #E31837 100%)'
  },
  'Metro': {
    letter: 'M',
    color: '#003399',
    gradient: 'linear-gradient(135deg, #003399 0%, #0055FF 100%)'
  }
};

// Market Logo Bileşeni
const MarketLogo = ({ market, size = 24 }: { market: string; size?: number }) => {
  const info = MARKET_INFO[market];
  
  if (!info) {
    return (
      <Group gap={6}>
        <Box
          style={{
            width: size + 6,
            height: size + 6,
            borderRadius: 6,
            background: 'var(--mantine-color-gray-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text fw={700} size="xs" c="dimmed">{market.charAt(0)}</Text>
        </Box>
        <Text size="sm" fw={500}>{market}</Text>
      </Group>
    );
  }

  return (
    <Group gap={8}>
      <Box
        style={{
          width: size + 6,
          height: size + 6,
          borderRadius: 6,
          background: info.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 8px ${info.color}40`
        }}
      >
        <Text fw={800} size={size > 20 ? 'sm' : 'xs'} c="white" style={{ lineHeight: 1 }}>
          {info.letter}
        </Text>
      </Box>
      <Text size="sm" fw={500}>{market}</Text>
    </Group>
  );
};

interface MarketPrice {
  id: string;
  item: string;
  source: string;
  unitPrice: number;
  unit: string;
  amount?: number;
  standardUnitPrice?: number;
  standardUnit?: string; // kg, L veya adet
  lastUpdated: string;
  change: number;
  availability: 'available' | 'limited' | 'unavailable';
  // Yeni alanlar
  minPrice?: number; // En uygun fiyat
  avgPrice?: number; // Ekonomik ortalama
  manualPrice?: number; // Manuel girilen fiyat
}

interface MarketSource {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastSync: string;
  itemCount: number;
}

interface FiyatKaynak {
  market: string;
  fiyat: number;
  birim: string;
  miktar?: number;
  birimFiyat?: number;
  birimTipi?: string; // kg, L veya adet
  urun?: string;
}

interface FiyatSonucu {
  urun: string;
  birim: string;
  piyasa: {
    min: number;
    max: number;
    ortalama: number;
    kaynaklar: FiyatKaynak[];
  };
  oneri: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OneriSonuc {
  success: boolean;
  girilen: string;
  duzeltilmis: string | null;
  genel_terim: boolean;
  kategori: string | null;
  oneriler: string[];
  mesaj: string;
  arama_yapilabilir: boolean;
}

export default function PiyasaRobotuPage() {
  const [chatOpened, { open: openChat, close: closeChat }] = useDisclosure(false);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [sources, setSources] = useState<MarketSource[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('price-asc');
  
  const [quickSearchValue, setQuickSearchValue] = useState('');
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);
  const [fiyatSonucu, setFiyatSonucu] = useState<FiyatSonucu | null>(null);
  const [fiyatLoading, setFiyatLoading] = useState(false);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Öneri sistemi
  const [oneriModalOpened, { open: openOneriModal, close: closeOneriModal }] = useDisclosure(false);
  const [oneriSonuc, setOneriSonuc] = useState<OneriSonuc | null>(null);
  
  // Düzenleme ve detay sistemi
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [selectedPrice, setSelectedPrice] = useState<MarketPrice | null>(null);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isInitialized) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: '🤖 Merhaba! Piyasa fiyatlarını araştırmak için ürün adı yazın.\n\nÖrnek: "pirinç baldo", "tavuk but", "zeytinyağı"',
        timestamp: new Date()
      }]);
      setIsInitialized(true);
      fetchSources();
      fetchPrices();
    }
  }, [isInitialized]);

  const fetchSources = async () => {
    try {
      const res = await fetch(`${API_URL}/planlama/market/sources`);
      const result = await res.json();
      if (result.success) setSources(result.sources);
    } catch (error) {
      console.error('Sources hatası:', error);
    }
  };

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/planlama/market`);
      const result = await res.json();
      if (result.success) setPrices(result.prices || []);
    } catch (error) {
      console.error('Fiyat hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  const collectPrices = async () => {
    setLoading(true);
    try {
      // Mevcut listeden ürün isimlerini al, yoksa default liste kullan
      const currentItems = prices.length > 0 
        ? [...new Set(prices.map(p => p.item))] // Unique ürün isimleri
        : ['domates', 'soğan', 'patates', 'tavuk', 'pirinç', 'bulgur', 'ayçiçek yağı'];
      
      const res = await fetch(`${API_URL}/planlama/market/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: currentItems.slice(0, 15), // Max 15 ürün (timeout önleme)
          sources: ['trendyol', 'migros']
        })
      });
      const result = await res.json();
      if (result.success) {
        notifications.show({ 
          title: '✅ Başarılı', 
          message: `${result.prices?.length || 0} fiyat güncellendi (${currentItems.length} ürün)`, 
          color: 'teal' 
        });
        await fetchPrices();
        await fetchSources();
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  // Her aramada önce öneri al ve kullanıcıya göster
  const handleQuickSearch = async () => {
    if (!quickSearchValue.trim() || quickSearchLoading) return;
    
    setQuickSearchLoading(true);
    
    try {
      // Önce öneri al
      const oneriRes = await fetch(`${API_URL}/planlama/piyasa/oneri`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arama_terimi: quickSearchValue.trim() })
      });
      const oneriResult = await oneriRes.json();
      
      if (!oneriResult.success) {
        throw new Error(oneriResult.error);
      }
      
      // Her zaman öneri modal'ını aç - kullanıcı onaylasın
      setOneriSonuc(oneriResult);
      openOneriModal();
      
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message || 'Öneri alınamadı', color: 'red' });
    } finally {
      setQuickSearchLoading(false);
    }
  };

  // Tek bir ürünün fiyatını güncelle (öneri modalı olmadan direkt)
  const refreshSingleItem = async (itemName: string, itemId: string) => {
    // O satırı loading state'ine al
    setPrices(prev => prev.map(p => 
      p.id === itemId ? { ...p, availability: 'limited' as const } : p
    ));
    
    try {
      const res = await fetch(`${API_URL}/planlama/piyasa/hizli-arastir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urun_adi: itemName })
      });
      const result = await res.json();
      
      if (result.success && result.piyasa) {
        // Mevcut ürünü güncelle
        setPrices(prev => prev.map(p => 
          p.id === itemId ? {
            ...p,
            unitPrice: result.piyasa.min || p.unitPrice,
            minPrice: result.piyasa.min,
            avgPrice: result.piyasa.ortalama,
            lastUpdated: new Date().toLocaleString('tr-TR'),
            availability: 'available' as const,
            change: p.unitPrice > 0 
              ? Number((((result.piyasa.min - p.unitPrice) / p.unitPrice) * 100).toFixed(1))
              : 0
          } : p
        ));
        notifications.show({ 
          title: '✅ Güncellendi', 
          message: `${itemName}: ₺${result.piyasa.min?.toFixed(2) || '—'}`, 
          color: 'teal' 
        });
      } else {
        throw new Error(result.error || 'Fiyat bulunamadı');
      }
    } catch (error: any) {
      // Hata durumunda eski state'e dön
      setPrices(prev => prev.map(p => 
        p.id === itemId ? { ...p, availability: 'available' as const } : p
      ));
      notifications.show({ title: 'Hata', message: error.message, color: 'red' });
    }
  };

  // Gerçek fiyat araması yap
  const doSearch = async (searchTerm: string) => {
    setFiyatLoading(true);
    openModal();
    closeOneriModal();
    
    try {
      const res = await fetch(`${API_URL}/planlama/piyasa/hizli-arastir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urun_adi: searchTerm })
      });
      const result = await res.json();
      if (result.success) {
        setFiyatSonucu(result);
        setQuickSearchValue('');
        await fetchSources();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      notifications.show({ title: 'Hata', message: error.message || 'Araştırma yapılamadı', color: 'red' });
      closeModal();
    } finally {
      setFiyatLoading(false);
    }
  };

  // Öneri seçildiğinde
  const handleOneriSelect = (oneri: string) => {
    doSearch(oneri);
  };

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const query = inputValue.trim();
    setInputValue('');
    setChatLoading(true);

    try {
      // Direkt fiyat araştırması yap
      const res = await fetch(`${API_URL}/planlama/piyasa/hizli-arastir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urun_adi: query })
      });
      const result = await res.json();

      let responseText = '';
      if (result.success && result.piyasa?.kaynaklar?.length > 0) {
        responseText = `📊 **${result.urun.toUpperCase()}** Fiyatları:\n\n`;
        responseText += `💰 Ortalama: ${formatMoney(result.piyasa.ortalama)}\n`;
        responseText += `📉 En Düşük: ${formatMoney(result.piyasa.min)}\n`;
        responseText += `📈 En Yüksek: ${formatMoney(result.piyasa.max)}\n\n`;
        responseText += `🏪 Bulunan Fiyatlar:\n`;
        result.piyasa.kaynaklar.slice(0, 5).forEach((k: FiyatKaynak) => {
          responseText += `• ${k.market}: ${formatMoney(k.fiyat)} - ${k.urun || result.urun}\n`;
        });
        await fetchSources();
      } else {
        responseText = `❌ "${query}" için fiyat bulunamadı.\n\nFarklı bir ürün adı deneyin:\n• tavuk but\n• pirinç baldo\n• zeytinyağı 5lt`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Hata: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setChatLoading(false);
    }
  }, [inputValue, chatLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatMoney = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
  };


  const filteredPrices = prices
    .filter(p => {
      const matchesSearch = p.item?.toLowerCase().includes(searchTerm.toLowerCase());
      // Kategori filtreleme (basit keyword eşleşmesi)
      const categoryKeywords: Record<string, string[]> = {
        sebze: ['domates', 'biber', 'soğan', 'patates', 'salatalık', 'patlıcan', 'havuç'],
        meyve: ['elma', 'portakal', 'muz', 'üzüm', 'karpuz', 'kavun', 'limon'],
        et: ['tavuk', 'et', 'dana', 'kuzu', 'but', 'pirzola', 'kıyma', 'biftek'],
        bakliyat: ['pirinç', 'bulgur', 'mercimek', 'nohut', 'fasulye', 'makarna'],
        sut: ['süt', 'yoğurt', 'peynir', 'ayran', 'tereyağı', 'kaymak'],
        yag: ['yağ', 'zeytinyağı', 'ayçiçek', 'sıvıyağ'],
        baharat: ['tuz', 'karabiber', 'kırmızı biber', 'kimyon', 'pul biber']
      };
      const matchesCategory = selectedCategory === 'all' || 
        categoryKeywords[selectedCategory]?.some(kw => p.item?.toLowerCase().includes(kw));
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const [field, order] = sortBy.split('-');
      if (field === 'price') return order === 'asc' ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice;
      if (field === 'name') return order === 'asc' ? (a.item || '').localeCompare(b.item || '') : (b.item || '').localeCompare(a.item || '');
      return 0;
    });

  const activeSources = sources.filter(s => s.status === 'active').length;

  return (
    <>
      <Container size="xl" py="xl">
        {/* Compact Header */}
        <Group justify="space-between" mb="lg">
          <Group gap="md">
            <ThemeIcon size={42} radius="lg" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
              <IconShoppingCart size={22} />
            </ThemeIcon>
            <Box>
              <Title order={3}>Piyasa Robotu</Title>
              <Group gap={6}>
                <Badge size="xs" variant="dot" color="violet">AI</Badge>
                <Badge size="xs" variant="outline" color="teal">{activeSources} Market Aktif</Badge>
              </Group>
            </Box>
          </Group>
          
          <Group gap="xs">
            <Button
              variant="light"
              color="violet"
              size="sm"
              leftSection={loading ? <Loader size={14} color="violet" /> : <IconRefresh size={16} />}
              onClick={collectPrices}
              disabled={loading}
              radius="md"
            >
              Güncelle
            </Button>
            <ActionIcon variant="light" color="gray" size="lg" radius="md">
              <IconDownload size={18} />
            </ActionIcon>
            <ActionIcon 
              variant="gradient" 
              gradient={{ from: 'violet', to: 'grape' }} 
              size="lg" 
              radius="md"
              onClick={openChat}
            >
              <IconMessageCircle size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Search Box */}
        <Paper
          p="xs"
          radius="lg"
          mb="lg"
          withBorder
        >
          <TextInput
            placeholder="Ürün adı yazın... (örn: pirinç baldo, tavuk but)"
            size="md"
            radius="md"
            value={quickSearchValue}
            onChange={(e) => setQuickSearchValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleQuickSearch()}
            leftSection={<IconSearch size={18} />}
            rightSection={
              quickSearchLoading ? (
                <Loader size="sm" color="violet" />
              ) : quickSearchValue ? (
                <ActionIcon variant="filled" color="violet" radius="md" onClick={handleQuickSearch}>
                  <IconChevronRight size={18} />
                </ActionIcon>
              ) : null
            }
            variant="unstyled"
          />
        </Paper>

        {/* Category Chips */}
        <ScrollArea mb="md" type="never">
          <Group gap="xs" wrap="nowrap">
            {[
              { id: 'all', label: 'Tümü', icon: '🏪' },
              { id: 'sebze', label: 'Sebze', icon: '🥬' },
              { id: 'meyve', label: 'Meyve', icon: '🍎' },
              { id: 'et', label: 'Et & Tavuk', icon: '🍖' },
              { id: 'bakliyat', label: 'Bakliyat', icon: '🌾' },
              { id: 'sut', label: 'Süt Ürünleri', icon: '🥛' },
              { id: 'yag', label: 'Yağ', icon: '🫒' },
              { id: 'baharat', label: 'Baharat', icon: '🌶️' }
            ].map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'filled' : 'light'}
                color={selectedCategory === cat.id ? 'violet' : 'gray'}
                size="xs"
                radius="xl"
                onClick={() => setSelectedCategory(cat.id)}
                style={{ flexShrink: 0 }}
              >
                {cat.icon} {cat.label}
              </Button>
            ))}
          </Group>
        </ScrollArea>

        {/* Simple Search & Sort */}
        <Group mb="md" gap="xs">
          <TextInput
            placeholder="Ürün ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftSection={<IconSearch size={16} />}
            radius="md"
            size="sm"
            style={{ flex: 1 }}
          />
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v || 'price-asc')}
            data={[
              { value: 'price-asc', label: 'Fiyat ↑' },
              { value: 'price-desc', label: 'Fiyat ↓' },
              { value: 'name-asc', label: 'A-Z' }
            ]}
            radius="md"
            size="sm"
            w={120}
          />
        </Group>

        {/* Price Table */}
        <Paper 
          radius="lg" 
          withBorder
          style={{ overflow: 'hidden' }}
        >
          <Box p="lg" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Group justify="space-between">
              <Group gap="sm">
                <IconChartBar size={20} color="var(--mantine-color-violet-5)" />
                <Text fw={700}>Güncel Fiyatlar</Text>
              </Group>
              <Badge variant="light" color="violet" size="lg">{filteredPrices.length} ürün</Badge>
            </Group>
          </Box>

          {loading ? (
            <Center py={80}>
              <Stack align="center" gap="md">
                <Loader size="lg" color="violet" type="dots" />
                <Text c="dimmed">Fiyatlar yükleniyor...</Text>
              </Stack>
            </Center>
          ) : filteredPrices.length === 0 ? (
            <Center py={80}>
              <Stack align="center" gap="md">
                <ThemeIcon size={64} radius="xl" variant="light" color="gray">
                  <IconSearch size={32} />
                </ThemeIcon>
                <Text c="dimmed" ta="center">
                  {prices.length === 0 
                    ? 'Henüz fiyat verisi yok.\n"Fiyatları Güncelle" butonuna tıklayın.'
                    : 'Sonuç bulunamadı'}
                </Text>
                {prices.length === 0 && (
                  <Button variant="light" color="violet" onClick={collectPrices} leftSection={<IconRefresh size={16} />}>
                    Fiyatları Topla
                  </Button>
                )}
              </Stack>
            </Center>
          ) : (
            <>
              {/* Toplu İşlem Bar */}
              {selectedItems.size > 0 && (
                <Box p="sm" mb="sm" style={{ background: 'var(--mantine-color-violet-light)', borderRadius: 8 }}>
                  <Group justify="space-between">
                    <Text c="violet" fw={500}>{selectedItems.size} ürün seçildi</Text>
                    <Group gap="xs">
                      <Button size="xs" variant="light" color="violet" leftSection={<IconRefresh size={14} />}>
                        Toplu Fiyat Güncelle
                      </Button>
                      <Button size="xs" variant="subtle" color="gray" onClick={() => setSelectedItems(new Set())}>
                        Seçimi Temizle
                      </Button>
                    </Group>
                  </Group>
                </Box>
              )}
              
              <Table.ScrollContainer minWidth={800}>
                <Table highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.size === filteredPrices.length && filteredPrices.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(new Set(filteredPrices.map(p => p.id)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                          style={{ cursor: 'pointer', accentColor: 'var(--mantine-color-violet-5)' }}
                        />
                      </Table.Th>
                      <Table.Th>Ürün</Table.Th>
                      <Table.Th>Miktar</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        <Text span c="teal" size="xs">●</Text> En Uygun
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        <Text span c="violet" size="xs">●</Text> Eko. Ort.
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        Manuel Fiyat
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'center', width: 80 }}>
                        İşlem
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredPrices.map((price, i) => (
                      <Table.Tr 
                        key={price.id || i}
                        className="price-row"
                        style={{ 
                          background: selectedItems.has(price.id) 
                            ? 'var(--mantine-color-violet-light)' 
                            : undefined,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setSelectedPrice(price);
                          openDetailModal();
                        }}
                      >
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(price.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedItems);
                              if (e.target.checked) {
                                newSet.add(price.id);
                              } else {
                                newSet.delete(price.id);
                              }
                              setSelectedItems(newSet);
                            }}
                            style={{ cursor: 'pointer', accentColor: 'var(--mantine-color-violet-5)' }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500} tt="capitalize">
                            {price.item?.toLowerCase()}
                          </Text>
                          <Text size="xs" c="dimmed" tt="capitalize">{price.source?.toLowerCase() || 'Bilinmiyor'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" color="gray" size="sm" style={{ fontWeight: 500 }}>
                            {price.amount || 1} {price.unit || 'adet'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text c="teal.4" fw={700}>{formatMoney(price.minPrice || price.unitPrice)}</Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text c="violet.4" fw={600}>{formatMoney(price.avgPrice || price.unitPrice)}</Text>
                        </Table.Td>
                        <Table.Td ta="right" onClick={(e) => e.stopPropagation()}>
                          {editingId === price.id ? (
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              <TextInput
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                size="xs"
                                w={80}
                                styles={{ input: { textAlign: 'right' } }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const newPrices = prices.map(p => 
                                      p.id === price.id ? { ...p, manualPrice: parseFloat(editValue) || undefined } : p
                                    );
                                    setPrices(newPrices);
                                    setEditingId(null);
                                    notifications.show({ title: '✓ Kaydedildi', message: 'Fiyat güncellendi', color: 'green' });
                                  }
                                }}
                                autoFocus
                              />
                              <ActionIcon size="xs" color="green" variant="filled" onClick={() => {
                                const newPrices = prices.map(p => 
                                  p.id === price.id ? { ...p, manualPrice: parseFloat(editValue) || undefined } : p
                                );
                                setPrices(newPrices);
                                setEditingId(null);
                                notifications.show({ title: '✓ Kaydedildi', message: 'Fiyat güncellendi', color: 'green' });
                              }}>
                                <IconCheck size={12} />
                              </ActionIcon>
                              <ActionIcon size="xs" color="red" variant="subtle" onClick={() => setEditingId(null)}>
                                <IconX size={12} />
                              </ActionIcon>
                            </Group>
                          ) : (
                            <Text 
                              c={price.manualPrice ? 'orange' : 'dimmed'} 
                              fw={price.manualPrice ? 700 : 400}
                              size="sm"
                              style={{ cursor: 'text' }}
                              onClick={() => {
                                setEditingId(price.id);
                                setEditValue(String(price.manualPrice || price.unitPrice || ''));
                              }}
                            >
                              {price.manualPrice ? formatMoney(price.manualPrice) : '—'}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td ta="center" onClick={(e) => e.stopPropagation()}>
                          <ActionIcon 
                            size="sm" 
                            variant="light" 
                            color="violet"
                            onClick={() => {
                              // Direkt bu ürünün fiyatını güncelle (öneri modalı olmadan)
                              refreshSingleItem(price.item, price.id);
                            }}
                            title="Fiyat Güncelle"
                          >
                            <IconRefresh size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </>
          )}
        </Paper>
      </Container>

      {/* Floating AI Button */}
      <Transition mounted={!chatOpened} transition="scale" duration={200}>
        {(styles) => (
          <ActionIcon
            style={{
              ...styles,
              position: 'fixed',
              bottom: 24,
              right: 24,
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
              zIndex: 1000
            }}
            onClick={openChat}
          >
            <IconRobot size={28} color="white" />
          </ActionIcon>
        )}
      </Transition>

      {/* AI Chat Drawer */}
      <Drawer
        opened={chatOpened}
        onClose={closeChat}
        position="right"
        size="md"
        withCloseButton={false}
        styles={{
          body: { height: '100%', display: 'flex', flexDirection: 'column', padding: 0 }
        }}
      >
        {/* Chat Header */}
        <Box 
          p="md" 
          style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="lg" radius="xl" variant="white" color="violet">
                <IconRobot size={20} />
              </ThemeIcon>
              <Box>
                <Text fw={700} c="white">Piyasa Asistanı</Text>
                <Text size="xs" c="rgba(255,255,255,0.7)">AI destekli fiyat araştırma</Text>
              </Box>
            </Group>
            <ActionIcon variant="subtle" color="white" onClick={closeChat} radius="xl">
              <IconX size={20} />
            </ActionIcon>
          </Group>
        </Box>

        {/* Chat Messages */}
        <ScrollArea style={{ flex: 1 }} p="md">
          <Stack gap="md">
            {messages.map((msg) => (
              <Box
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Paper
                  p="sm"
                  radius="lg"
                  maw="85%"
                  withBorder={msg.role === 'assistant'}
                  style={{
                    background: msg.role === 'user' 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : undefined
                  }}
                >
                  <Text size="sm" c={msg.role === 'user' ? 'white' : undefined} style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                </Paper>
              </Box>
            ))}
            {chatLoading && (
              <Paper p="sm" radius="lg" withBorder>
                <Group gap="xs">
                  <Loader size="xs" color="violet" />
                  <Text size="sm" c="dimmed">Araştırıyorum...</Text>
                </Group>
              </Paper>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        </ScrollArea>

        {/* Chat Input */}
        <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap="xs">
            <TextInput
              placeholder="Ürün adı yazın... (örn: tavuk but)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              style={{ flex: 1 }}
              radius="xl"
              size="md"
              disabled={chatLoading}
            />
            <ActionIcon 
              size={44} 
              radius="xl" 
              variant="gradient" 
              gradient={{ from: 'violet', to: 'grape' }}
              onClick={sendMessage} 
              disabled={chatLoading || !inputValue.trim()}
            >
              <IconSend size={20} />
            </ActionIcon>
          </Group>
        </Box>
      </Drawer>

      {/* Price Result Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        size="lg"
        radius="xl"
        centered
        withCloseButton={false}
        styles={{
          body: { padding: 0 }
        }}
      >
        {fiyatLoading ? (
          <Center py={80}>
            <Stack align="center" gap="md">
              <Loader size="lg" color="violet" type="dots" />
              <Text c="gray.5">Piyasa fiyatları araştırılıyor...</Text>
            </Stack>
          </Center>
        ) : fiyatSonucu ? (
          <Stack gap={0}>
            {/* Modal Header */}
            <Box 
              p="lg" 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 'var(--mantine-radius-xl) var(--mantine-radius-xl) 0 0'
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="xl" variant="white" color="violet">
                    <IconSearch size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700} c="white" size="lg" tt="capitalize">{fiyatSonucu.urun}</Text>
                    <Text size="xs" c="rgba(255,255,255,0.7)">{fiyatSonucu.piyasa.kaynaklar.length} farklı fiyat bulundu</Text>
                  </Box>
                </Group>
                <ActionIcon variant="subtle" color="white" onClick={closeModal} radius="xl">
                  <IconX size={20} />
                </ActionIcon>
              </Group>
            </Box>

            {/* Stats */}
            <SimpleGrid cols={3} p="md" style={{ background: 'var(--mantine-color-gray-light)' }}>
              <Box ta="center" py="sm">
                <Text size="xs" c="dimmed" mb={4}>🏷️ En Ucuz</Text>
                <Text size="xl" fw={800} c="teal">{formatMoney(fiyatSonucu.piyasa.min)}</Text>
                <Text size="xs" c="dimmed">/{fiyatSonucu.birim}</Text>
              </Box>
              <Box ta="center" py="sm" style={{ borderLeft: '1px solid var(--mantine-color-default-border)', borderRight: '1px solid var(--mantine-color-default-border)' }}>
                <Text size="xs" c="dimmed" mb={4}>📊 Ekonomik Ort.</Text>
                <Text size="xl" fw={800} c="violet">{formatMoney(fiyatSonucu.piyasa.ortalama)}</Text>
                <Text size="xs" c="dimmed">/{fiyatSonucu.birim}</Text>
              </Box>
              <Box ta="center" py="sm">
                <Text size="xs" c="dimmed" mb={4}>💎 Premium</Text>
                <Text size="xl" fw={800} c="orange">{formatMoney(fiyatSonucu.piyasa.max)}</Text>
                <Text size="xs" c="dimmed">/{fiyatSonucu.birim}</Text>
              </Box>
            </SimpleGrid>

            {/* Price List */}
            <Box p="md">
              <Text fw={600} mb="sm">Bulunan Fiyatlar</Text>
              <Stack gap="xs">
                {fiyatSonucu.piyasa.kaynaklar.map((kaynak, i) => (
                  <Paper
                    key={i}
                    p="sm"
                    radius="md"
                    withBorder
                    style={{
                      background: i === 0 ? 'var(--mantine-color-teal-light)' : undefined
                    }}
                  >
                    <Group justify="space-between">
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={500} lineClamp={1}>{kaynak.urun || fiyatSonucu.urun}</Text>
                        <Group gap="xs" mt={4}>
                          <MarketLogo market={kaynak.market} size={18} />
                        </Group>
                      </Box>
                      <Stack gap={2} align="flex-end">
                        <Group gap="xs" align="center">
                          {/* Ana fiyat: birim fiyatı (kg/L) göster */}
                          <Text fw={700} c={i === 0 ? 'teal' : undefined} size="lg">
                            {formatMoney(kaynak.birimFiyat || kaynak.fiyat)}
                            {kaynak.birimTipi && kaynak.birimTipi !== 'adet' && (
                              <Text component="span" size="sm" c="dimmed" fw={400}>/{kaynak.birimTipi}</Text>
                            )}
                          </Text>
                          {i === 0 && <Badge size="xs" color="teal">EN UCUZ</Badge>}
                        </Group>
                        {/* Alt satır: toplam paket fiyatı göster (farklıysa) */}
                        {kaynak.birimFiyat && kaynak.birimFiyat !== kaynak.fiyat && (
                          <Text size="xs" c="dimmed">
                            Paket: {formatMoney(kaynak.fiyat)}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>

            {/* AI Recommendation */}
            <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Paper p="md" radius="md" style={{ background: 'var(--mantine-color-violet-light)' }}>
                <Group gap="sm" align="flex-start">
                  <IconSparkles size={20} color="var(--mantine-color-violet-6)" />
                  <Text size="sm">{fiyatSonucu.oneri}</Text>
                </Group>
              </Paper>
            </Box>

            {/* Actions */}
            <Group p="md" justify="flex-end" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Button variant="subtle" color="gray" onClick={closeModal}>Kapat</Button>
              <Button variant="gradient" gradient={{ from: 'violet', to: 'grape' }} leftSection={<IconCheck size={16} />}>
                Listeye Ekle
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      {/* Öneri Modal */}
      <Modal
        opened={oneriModalOpened}
        onClose={closeOneriModal}
        size="md"
        radius="xl"
        centered
        withCloseButton={false}
        styles={{
          body: { padding: 0 }
        }}
      >
        {oneriSonuc && (
          <Stack gap={0}>
            {/* Header */}
            <Box 
              p="lg" 
              style={{ 
                background: oneriSonuc.duzeltilmis 
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                  : oneriSonuc.arama_yapilabilir
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 'var(--mantine-radius-xl) var(--mantine-radius-xl) 0 0'
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="xl" variant="white" color={oneriSonuc.duzeltilmis ? 'orange' : oneriSonuc.arama_yapilabilir ? 'green' : 'violet'}>
                    {oneriSonuc.duzeltilmis ? <IconSparkles size={20} /> : oneriSonuc.arama_yapilabilir ? <IconCheck size={20} /> : <IconSearch size={20} />}
                  </ThemeIcon>
                  <Box>
                    <Text fw={700} c="white" size="lg">
                      {oneriSonuc.duzeltilmis ? '✏️ Yazım Düzeltme' : oneriSonuc.arama_yapilabilir ? '✅ Ürün Onayı' : '🎯 Ürün Seçin'}
                    </Text>
                    <Text size="xs" c="rgba(255,255,255,0.7)">{oneriSonuc.mesaj}</Text>
                  </Box>
                </Group>
                <ActionIcon variant="subtle" color="white" onClick={closeOneriModal} radius="xl">
                  <IconX size={20} />
                </ActionIcon>
              </Group>
            </Box>

            {/* Girilen değer */}
            {oneriSonuc.duzeltilmis && (
              <Box p="md" style={{ background: 'var(--mantine-color-orange-light)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="center" gap="md">
                  <Badge size="lg" variant="outline" color="red" style={{ textDecoration: 'line-through' }}>
                    {oneriSonuc.girilen}
                  </Badge>
                  <IconChevronRight size={20} color="var(--mantine-color-gray-5)" />
                  <Badge size="lg" variant="filled" color="green">
                    {oneriSonuc.duzeltilmis}
                  </Badge>
                </Group>
              </Box>
            )}

            {/* Öneriler */}
            <Box p="md">
              <Text fw={600} mb="sm">
                {oneriSonuc.kategori ? `${oneriSonuc.kategori} Önerileri` : 'Önerilen Ürünler'}
              </Text>
              <Stack gap="xs">
                {oneriSonuc.oneriler.map((oneri, i) => (
                  <Paper
                    key={i}
                    p="sm"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                    onClick={() => handleOneriSelect(oneri)}
                    className="hover-lift"
                  >
                    <Group justify="space-between">
                      <Group gap="sm">
                        <ThemeIcon size="sm" radius="xl" variant="light" color="violet">
                          <IconShoppingCart size={12} />
                        </ThemeIcon>
                        <Text size="sm" fw={500}>{oneri}</Text>
                      </Group>
                      <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>

            {/* Spesifik ürün için direkt arama butonu */}
            {oneriSonuc.arama_yapilabilir && (
              <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
                <Button 
                  fullWidth 
                  size="lg"
                  variant="gradient" 
                  gradient={{ from: 'teal', to: 'green' }}
                  leftSection={<IconSearch size={20} />}
                  onClick={() => handleOneriSelect(oneriSonuc.girilen)}
                >
                  "{oneriSonuc.girilen}" için Fiyat Ara
                </Button>
              </Box>
            )}

            {/* Alt bilgi */}
            <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="xs" c="dimmed" ta="center">
                💡 Daha doğru fiyatlar için ürün adını ve gramajını belirtin
              </Text>
            </Box>
          </Stack>
        )}
      </Modal>

      {/* Ürün Detay Modal */}
      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        size="md"
        radius="xl"
        centered
        withCloseButton={false}
        styles={{
          body: { padding: 0 }
        }}
      >
        {selectedPrice && (
          <Stack gap={0}>
            {/* Header */}
            <Box 
              p="lg" 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 'var(--mantine-radius-xl) var(--mantine-radius-xl) 0 0'
              }}
            >
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="xl" variant="white" color="violet">
                    <IconShoppingCart size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text fw={700} c="white" size="lg">{selectedPrice.item}</Text>
                    <Text size="xs" c="rgba(255,255,255,0.7)">{selectedPrice.source || 'Kaynak bilinmiyor'}</Text>
                  </Box>
                </Group>
                <ActionIcon variant="subtle" color="white" onClick={closeDetailModal} radius="xl">
                  <IconX size={20} />
                </ActionIcon>
              </Group>
            </Box>

            {/* Fiyat Bilgileri */}
            <SimpleGrid cols={3} p="md" style={{ background: 'var(--mantine-color-gray-light)' }}>
              <Box ta="center" py="sm">
                <Text size="xs" c="dimmed" mb={4}>En Uygun</Text>
                <Text size="xl" fw={800} c="teal">{formatMoney(selectedPrice.minPrice || selectedPrice.unitPrice)}</Text>
              </Box>
              <Box ta="center" py="sm" style={{ borderLeft: '1px solid var(--mantine-color-default-border)', borderRight: '1px solid var(--mantine-color-default-border)' }}>
                <Text size="xs" c="dimmed" mb={4}>Eko. Ortalama</Text>
                <Text size="xl" fw={800} c="violet">{formatMoney(selectedPrice.avgPrice || selectedPrice.unitPrice)}</Text>
              </Box>
              <Box ta="center" py="sm">
                <Text size="xs" c="dimmed" mb={4}>Manuel Fiyat</Text>
                <Text size="xl" fw={800} c={selectedPrice.manualPrice ? 'orange' : 'dimmed'}>
                  {selectedPrice.manualPrice ? formatMoney(selectedPrice.manualPrice) : '—'}
                </Text>
              </Box>
            </SimpleGrid>

            {/* Detaylar */}
            <Box p="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text c="dimmed" size="sm">Miktar:</Text>
                  <Badge variant="outline" color="gray">{selectedPrice.amount || 1} {selectedPrice.unit || 'adet'}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" size="sm">Birim Fiyat:</Text>
                  <Text fw={600}>
                    {selectedPrice.standardUnitPrice 
                      ? `${formatMoney(selectedPrice.standardUnitPrice)}/${selectedPrice.standardUnit}` 
                      : '—'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed" size="sm">Son Güncelleme:</Text>
                  <Text fw={500} size="sm">{selectedPrice.lastUpdated || '—'}</Text>
                </Group>
              </Stack>
            </Box>

            {/* Actions */}
            <Group p="md" justify="space-between" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Button 
                variant="light" 
                color="violet" 
                leftSection={<IconRefresh size={16} />}
                onClick={() => {
                  closeDetailModal();
                  setQuickSearchValue(selectedPrice.item);
                  handleQuickSearch();
                }}
              >
                Fiyat Güncelle
              </Button>
              <Button variant="subtle" color="gray" onClick={closeDetailModal}>Kapat</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
