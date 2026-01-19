'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Card,
  CloseButton,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconChevronRight,
  IconCurrencyLira,
  IconList,
  IconMap,
  IconMapPin,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import type { Tender } from '@/types/api';

// Türkiye 81 İl Koordinatları
const TURKEY_CITIES: Record<string, [number, number]> = {
  'Adana': [37.0000, 35.3213],
  'Adıyaman': [37.7648, 38.2786],
  'Afyon': [38.7507, 30.5567],
  'Afyonkarahisar': [38.7507, 30.5567],
  'Ağrı': [39.7191, 43.0503],
  'Aksaray': [38.3687, 34.0370],
  'Amasya': [40.6499, 35.8353],
  'Ankara': [39.9334, 32.8597],
  'Antalya': [36.8969, 30.7133],
  'Ardahan': [41.1105, 42.7022],
  'Artvin': [41.1828, 41.8183],
  'Aydın': [37.8560, 27.8416],
  'Balıkesir': [39.6484, 27.8826],
  'Bartın': [41.6344, 32.3375],
  'Batman': [37.8812, 41.1351],
  'Bayburt': [40.2552, 40.2249],
  'Bilecik': [40.0567, 30.0665],
  'Bingöl': [38.8854, 40.4966],
  'Bitlis': [38.4006, 42.1095],
  'Bolu': [40.7392, 31.6089],
  'Burdur': [37.7203, 30.2900],
  'Bursa': [40.1826, 29.0665],
  'Çanakkale': [40.1553, 26.4142],
  'Çankırı': [40.6013, 33.6134],
  'Çorum': [40.5506, 34.9556],
  'Denizli': [37.7765, 29.0864],
  'Diyarbakır': [37.9144, 40.2306],
  'Düzce': [40.8438, 31.1565],
  'Edirne': [41.6818, 26.5623],
  'Elazığ': [38.6810, 39.2264],
  'Erzincan': [39.7500, 39.5000],
  'Erzurum': [39.9000, 41.2700],
  'Eskişehir': [39.7767, 30.5206],
  'Gaziantep': [37.0662, 37.3833],
  'Giresun': [40.9128, 38.3895],
  'Gümüşhane': [40.4386, 39.5086],
  'Hakkari': [37.5833, 43.7333],
  'Hatay': [36.4018, 36.3498],
  'Iğdır': [39.9167, 44.0333],
  'Isparta': [37.7648, 30.5566],
  'İstanbul': [41.0082, 28.9784],
  'İzmir': [38.4192, 27.1287],
  'Kahramanmaraş': [37.5858, 36.9371],
  'Karabük': [41.2061, 32.6204],
  'Karaman': [37.1759, 33.2287],
  'Kars': [40.6167, 43.1000],
  'Kastamonu': [41.3887, 33.7827],
  'Kayseri': [38.7312, 35.4787],
  'Kırıkkale': [39.8468, 33.5153],
  'Kırklareli': [41.7333, 27.2167],
  'Kırşehir': [39.1425, 34.1709],
  'Kilis': [36.7184, 37.1212],
  'Kocaeli': [40.8533, 29.8815],
  'Konya': [37.8667, 32.4833],
  'Kütahya': [39.4167, 29.9833],
  'Malatya': [38.3552, 38.3095],
  'Manisa': [38.6191, 27.4289],
  'Mardin': [37.3212, 40.7245],
  'Mersin': [36.8000, 34.6333],
  'Muğla': [37.2153, 28.3636],
  'Muş': [38.9462, 41.7539],
  'Nevşehir': [38.6939, 34.6857],
  'Niğde': [37.9667, 34.6833],
  'Ordu': [40.9839, 37.8764],
  'Osmaniye': [37.0746, 36.2477],
  'Rize': [41.0201, 40.5234],
  'Sakarya': [40.6940, 30.4358],
  'Samsun': [41.2928, 36.3313],
  'Siirt': [37.9333, 41.9500],
  'Sinop': [42.0231, 35.1531],
  'Sivas': [39.7477, 37.0179],
  'Şanlıurfa': [37.1591, 38.7969],
  'Şırnak': [37.4187, 42.4918],
  'Tekirdağ': [40.9833, 27.5167],
  'Tokat': [40.3167, 36.5500],
  'Trabzon': [41.0015, 39.7178],
  'Tunceli': [39.1079, 39.5401],
  'Uşak': [38.6823, 29.4082],
  'Van': [38.4891, 43.4089],
  'Yalova': [40.6500, 29.2667],
  'Yozgat': [39.8181, 34.8147],
  'Zonguldak': [41.4564, 31.7987],
  // Alternatif yazımlar
  'K.Maraş': [37.5858, 36.9371],
  'K.maraş': [37.5858, 36.9371],
  'Ş.Urfa': [37.1591, 38.7969],
  'Şanliurfa': [37.1591, 38.7969],
  'Diyarbakir': [37.9144, 40.2306],
  'Istanbul': [41.0082, 28.9784],
  'Izmir': [38.4192, 27.1287],
  'Mugla': [37.2153, 28.3636],
  'Nevsehir': [38.6939, 34.6857],
  'Nigde': [37.9667, 34.6833],
  'Sirnak': [37.4187, 42.4918],
  'Tekirdag': [40.9833, 27.5167],
  'Usak': [38.6823, 29.4082],
};

// Şehir adını normalize et
function normalizeCity(city: string): string {
  if (!city) return '';
  let normalized = city.trim();
  if (normalized.includes('/')) {
    normalized = normalized.split('/')[0].trim();
  }
  if (normalized.includes('-')) {
    normalized = normalized.split('-')[0].trim();
  }
  return normalized;
}

// Şehir koordinatı bul
function getCityCoordinates(city: string): [number, number] | null {
  const normalized = normalizeCity(city);
  if (TURKEY_CITIES[normalized]) {
    return TURKEY_CITIES[normalized];
  }
  const lowerCity = normalized.toLowerCase();
  for (const [key, coords] of Object.entries(TURKEY_CITIES)) {
    if (key.toLowerCase() === lowerCity) {
      return coords;
    }
  }
  for (const [key, coords] of Object.entries(TURKEY_CITIES)) {
    if (key.toLowerCase().includes(lowerCity) || lowerCity.includes(key.toLowerCase())) {
      return coords;
    }
  }
  return null;
}

interface TenderMapModalProps {
  opened: boolean;
  onClose: () => void;
  tenders: Tender[];
}

interface CityTenderGroup {
  city: string;
  coordinates: [number, number];
  tenders: Tender[];
  activeCount: number;
  totalCost: number;
}

// Harita komponenti - tamamen ayrı
function LeafletMap({ 
  cityGroups, 
  onCitySelect 
}: { 
  cityGroups: CityTenderGroup[];
  onCitySelect: (city: string) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Leaflet CSS'i ekle
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Leaflet'i yükle ve haritayı oluştur
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current).setView([39.0, 35.0], 6);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Marker icon
      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      // Marker'ları ekle
      cityGroups.forEach((group) => {
        const marker = L.marker(group.coordinates, { icon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width: 120px;">
            <strong>${group.city}</strong><br/>
            <span style="color: #666;">${group.tenders.length} ihale</span><br/>
            <span style="color: green;">${group.activeCount} aktif</span>
          </div>
        `);
        marker.on('click', () => {
          onCitySelect(group.city);
        });
      });
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [cityGroups, onCitySelect]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}

export default function TenderMapModal({ opened, onClose, tenders: initialTenders }: TenderMapModalProps) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [allTenders, setAllTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal açıldığında TÜM ihaleleri çek
  useEffect(() => {
    if (opened) {
      setMapKey((k) => k + 1);
      setSelectedCity(null);
      
      // Tüm ihaleleri çek (limit yüksek)
      setLoading(true);
      fetch(`${API_BASE_URL}/api/tenders?limit=1000&status=active`)
        .then((res) => res.json())
        .then((data) => {
          if (data.tenders) {
            setAllTenders(data.tenders);
          }
        })
        .catch((err) => {
          console.error('İhaleler yüklenemedi:', err);
          setAllTenders(initialTenders); // Fallback
        })
        .finally(() => setLoading(false));
    }
  }, [opened, initialTenders]);

  // İhaleleri şehir bazında grupla
  const tenders = allTenders.length > 0 ? allTenders : initialTenders;
  
  const cityGroups = useMemo(() => {
    const groups: Record<string, CityTenderGroup> = {};
    
    for (const tender of tenders) {
      const city = tender.city || tender.location || '';
      if (!city) continue;
      
      const normalizedCity = normalizeCity(city);
      const coords = getCityCoordinates(city);
      
      if (!coords) continue;
      
      if (!groups[normalizedCity]) {
        groups[normalizedCity] = {
          city: normalizedCity,
          coordinates: coords,
          tenders: [],
          activeCount: 0,
          totalCost: 0,
        };
      }
      
      groups[normalizedCity].tenders.push(tender);
      
      if (tender.status === 'active') {
        groups[normalizedCity].activeCount++;
      }
      
      if (tender.estimated_cost) {
        groups[normalizedCity].totalCost += tender.estimated_cost;
      }
    }
    
    return Object.values(groups).sort((a, b) => b.tenders.length - a.tenders.length);
  }, [tenders]);

  const selectedCityTenders = useMemo(() => {
    if (!selectedCity) return [];
    const group = cityGroups.find((g) => g.city === selectedCity);
    return group?.tenders || [];
  }, [selectedCity, cityGroups]);

  const stats = useMemo(() => {
    const totalTenders = cityGroups.reduce((sum, g) => sum + g.tenders.length, 0);
    const activeTenders = cityGroups.reduce((sum, g) => sum + g.activeCount, 0);
    const totalCost = cityGroups.reduce((sum, g) => sum + g.totalCost, 0);
    const cityCount = cityGroups.length;
    return { totalTenders, activeTenders, totalCost, cityCount };
  }, [cityGroups]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  if (!opened) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="95vw"
      padding={0}
      withCloseButton={false}
      closeOnClickOutside={false}
      styles={{
        content: {
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <Paper
        p="md"
        style={{
          background: 'linear-gradient(135deg, #1a1b4b 0%, #2d1f5e 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Group justify="space-between">
          <Group gap="md">
            <IconMap size={28} color="#a78bfa" />
            <div>
              <Title order={3} c="white">
                İhale Haritası
              </Title>
              <Text size="sm" c="dimmed">
                {stats.cityCount} şehirde {stats.totalTenders} ihale • {stats.activeTenders} aktif
              </Text>
            </div>
          </Group>
          
          <Group gap="xs">
            {stats.totalCost > 0 && (
              <Badge
                size="lg"
                variant="gradient"
                gradient={{ from: 'green', to: 'teal' }}
                leftSection={<IconCurrencyLira size={14} />}
              >
                Toplam: {formatCurrency(stats.totalCost)}
              </Badge>
            )}
            <CloseButton
              size="lg"
              variant="subtle"
              c="white"
              onClick={onClose}
            />
          </Group>
        </Group>
      </Paper>

      {/* Content */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Map */}
        <Box style={{ flex: 1, position: 'relative', background: '#1a1b2e' }}>
          {loading ? (
            <Box
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Stack align="center" gap="md">
                <Loader size="lg" color="violet" />
                <Text c="white">İhaleler yükleniyor...</Text>
              </Stack>
            </Box>
          ) : (
            <LeafletMap 
              key={mapKey}
              cityGroups={cityGroups} 
              onCitySelect={(city) => {
                setSelectedCity(city);
                setSidebarOpen(true); // Sidebar'ı otomatik aç
              }} 
            />
          )}
        </Box>

        {/* Sidebar Toggle Button */}
        <Box
          style={{
            position: 'absolute',
            right: sidebarOpen ? 320 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1000,
            transition: 'right 0.3s ease',
          }}
        >
          <ActionIcon
            size="xl"
            variant="filled"
            color="violet"
            radius="xl"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            {sidebarOpen ? <IconChevronRight size={20} /> : <IconList size={20} />}
          </ActionIcon>
        </Box>

        {/* Sidebar */}
        <Paper
          style={{
            width: sidebarOpen ? 320 : 0,
            minWidth: sidebarOpen ? 320 : 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: sidebarOpen ? '1px solid rgba(255,255,255,0.1)' : 'none',
            background: 'rgba(26, 27, 46, 0.95)',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
          {sidebarOpen && (
            <>
              {selectedCity ? (
                <>
                  <Paper p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>
                    <Group justify="space-between">
                      <Group gap="sm">
                        <IconMapPin size={18} color="#a78bfa" />
                        <div>
                          <Text fw={600} c="white" size="sm">{selectedCity}</Text>
                          <Text size="xs" c="gray.5">
                            {selectedCityTenders.length} ihale
                          </Text>
                        </div>
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => setSelectedCity(null)}
                      >
                        <IconX size={14} color="white" />
                      </ActionIcon>
                    </Group>
                  </Paper>

                  <ScrollArea style={{ flex: 1 }} p="xs">
                    <Stack gap="xs">
                      {selectedCityTenders.map((tender) => (
                        <Card
                          key={tender.id}
                          padding="xs"
                          radius="md"
                          withBorder
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderColor: tender.status === 'active' 
                              ? 'rgba(34, 197, 94, 0.4)' 
                              : 'rgba(255,255,255,0.1)',
                            cursor: 'pointer',
                          }}
                          onClick={() => window.open(`/tenders/${tender.id}`, '_blank')}
                        >
                          <Stack gap={4}>
                            <Group justify="space-between" wrap="nowrap">
                              <Badge
                                size="xs"
                                variant="filled"
                                color={tender.status === 'active' ? 'green' : 'gray'}
                              >
                                {tender.status === 'active' ? 'Aktif' : 'Bitti'}
                              </Badge>
                              <Text size="xs" c="gray.5">
                                {formatDate(tender.tender_date || tender.deadline)}
                              </Text>
                            </Group>
                            
                            <Text size="xs" fw={500} lineClamp={2} c="white">
                              {tender.title}
                            </Text>
                            
                            {tender.estimated_cost && tender.estimated_cost > 0 && (
                              <Text size="xs" c="green.4" fw={500}>
                                {formatCurrency(tender.estimated_cost)}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      ))}
                    </Stack>
                  </ScrollArea>
                </>
              ) : (
                <>
                  <Paper p="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}>
                    <Group gap="sm">
                      <IconMapPin size={18} color="#a78bfa" />
                      <div>
                        <Text fw={600} c="white" size="sm">Şehirler ({cityGroups.length})</Text>
                        <Text size="xs" c="gray.5">
                          Haritada veya listeden seçin
                        </Text>
                      </div>
                    </Group>
                  </Paper>

                  <ScrollArea style={{ flex: 1 }} p="xs">
                    <Stack gap={4}>
                      {cityGroups.map((group) => (
                        <Card
                          key={group.city}
                          padding="xs"
                          radius="sm"
                          withBorder
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            borderColor: 'rgba(255,255,255,0.08)',
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedCity(group.city)}
                        >
                          <Group justify="space-between">
                            <Text size="sm" fw={500} c="white">{group.city}</Text>
                            <Group gap={4}>
                              <Text size="xs" c="gray.5">
                                {group.activeCount}/{group.tenders.length}
                              </Text>
                              <Badge size="xs" variant="filled" color="violet">
                                {group.tenders.length}
                              </Badge>
                            </Group>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  </ScrollArea>
                </>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Modal>
  );
}
