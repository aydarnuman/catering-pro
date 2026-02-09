'use client';

import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconChevronDown,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '@/lib/api';
import type { FirmaBilgileri } from './types';

interface FirmaBilgileriCardProps {
  firmalar: FirmaBilgileri[];
  firmaLoading: boolean;
  handleOpenFirmaModal: (firma?: FirmaBilgileri) => void;
  API_BASE_URL: string;
}

export default function FirmaBilgileriCard({
  firmalar,
  firmaLoading,
  handleOpenFirmaModal,
  API_BASE_URL,
}: FirmaBilgileriCardProps) {
  const varsayilanFirma = firmalar.find((f) => f.varsayilan) || firmalar[0];

  // Ekstra alanlar state
  const [ekstraAlanlar, setEkstraAlanlar] = useState<Record<string, unknown>>({});
  const [alanSablonlari, setAlanSablonlari] = useState<
    Array<{ alan_adi: string; gorunen_ad: string }>
  >([]);
  const [ekstraAlanlarExpanded, setEkstraAlanlarExpanded] = useState(false);
  const [newAlanAdi, setNewAlanAdi] = useState('');
  const [newAlanDeger, setNewAlanDeger] = useState('');

  const fetchEkstraAlanlar = useCallback(async () => {
    if (!varsayilanFirma?.id) return;
    try {
      const [sablonRes, ekstraRes] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/firmalar/alan-sablonlari`),
        authFetch(`${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/ekstra-alanlar`),
      ]);

      if (sablonRes.ok) {
        const sablonData = await sablonRes.json();
        setAlanSablonlari(sablonData.data || []);
      }

      if (ekstraRes.ok) {
        const ekstraData = await ekstraRes.json();
        setEkstraAlanlar(ekstraData.data || {});
      }
    } catch (err) {
      console.error('Ekstra alanlar yüklenemedi:', err);
    }
  }, [varsayilanFirma?.id, API_BASE_URL]);

  useEffect(() => {
    if (varsayilanFirma?.id) fetchEkstraAlanlar();
  }, [varsayilanFirma?.id, fetchEkstraAlanlar]);

  const handleAddEkstraAlan = async (alanAdi: string, deger: string) => {
    if (!varsayilanFirma?.id || !alanAdi) return;
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/ekstra-alan`,
        { method: 'PATCH', body: JSON.stringify({ alan_adi: alanAdi, deger }) }
      );
      const data = await res.json();
      if (data.success) {
        setEkstraAlanlar(data.data.ekstra_alanlar || {});
        setNewAlanAdi('');
        setNewAlanDeger('');
        notifications.show({
          title: '✅ Alan Eklendi',
          message: `${alanAdi} başarıyla kaydedildi`,
          color: 'green',
        });
      } else {
        notifications.show({ title: 'Hata', message: data.error, color: 'red' });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Alan eklenemedi', color: 'red' });
    }
  };

  const handleDeleteEkstraAlan = async (alanAdi: string) => {
    if (!varsayilanFirma?.id) return;
    try {
      const res = await authFetch(
        `${API_BASE_URL}/api/firmalar/${varsayilanFirma.id}/ekstra-alan/${alanAdi}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        setEkstraAlanlar(data.data.ekstra_alanlar || {});
        notifications.show({
          title: '✅ Alan Silindi',
          message: `${alanAdi} kaldırıldı`,
          color: 'green',
        });
      }
    } catch (_err) {
      notifications.show({ title: 'Hata', message: 'Alan silinemedi', color: 'red' });
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>🏢 Firma Bilgileri</Title>
          <Text size="sm" c="dimmed">
            Şirket ve yetkili bilgileriniz
          </Text>
        </div>
        <Button
          leftSection={<IconBuilding size={16} />}
          onClick={() => handleOpenFirmaModal(varsayilanFirma || undefined)}
          color="teal"
          variant={varsayilanFirma ? 'light' : 'filled'}
        >
          {varsayilanFirma ? 'Düzenle' : 'Firma Ekle'}
        </Button>
      </Group>

      {firmaLoading ? (
        <Skeleton height={150} radius="md" />
      ) : varsayilanFirma ? (
        <Paper
          p="lg"
          radius="md"
          withBorder
          style={{
            borderColor: 'var(--mantine-color-teal-4)',
            background: 'rgba(0, 166, 125, 0.02)',
          }}
        >
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Sol: Firma Bilgileri */}
            <Stack gap="sm">
              <Group gap="sm">
                <ThemeIcon size="lg" radius="md" variant="light" color="teal">
                  <IconBuilding size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={700} size="lg">
                    {varsayilanFirma.unvan}
                  </Text>
                  {varsayilanFirma.kisa_ad && (
                    <Text size="xs" c="dimmed">
                      ({varsayilanFirma.kisa_ad})
                    </Text>
                  )}
                </div>
              </Group>
              <Divider />
              <SimpleGrid cols={2} spacing="xs">
                <Text size="sm">
                  <Text span fw={500}>Vergi No:</Text> {varsayilanFirma.vergi_no || '-'}
                </Text>
                <Text size="sm">
                  <Text span fw={500}>Vergi Dairesi:</Text> {varsayilanFirma.vergi_dairesi || '-'}
                </Text>
                <Text size="sm">
                  <Text span fw={500}>Telefon:</Text> {varsayilanFirma.telefon || '-'}
                </Text>
                <Text size="sm">
                  <Text span fw={500}>E-posta:</Text> {varsayilanFirma.email || '-'}
                </Text>
              </SimpleGrid>
              {varsayilanFirma.adres && (
                <Text size="sm">
                  <Text span fw={500}>Adres:</Text> {varsayilanFirma.adres}
                </Text>
              )}
            </Stack>

            {/* Sağ: Yetkili Bilgileri */}
            <Stack gap="sm">
              <Group gap="sm">
                <Avatar size="md" radius="xl" color="violet">
                  {varsayilanFirma.yetkili_adi
                    ?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2) || '?'}
                </Avatar>
                <div>
                  <Text fw={600}>{varsayilanFirma.yetkili_adi || 'Yetkili eklenmemiş'}</Text>
                  <Text size="xs" c="violet">
                    {varsayilanFirma.yetkili_unvani || 'Şirket Yetkilisi'}
                  </Text>
                </div>
              </Group>
              {varsayilanFirma.yetkili_adi && (
                <>
                  <Divider />
                  <SimpleGrid cols={1} spacing="xs">
                    {varsayilanFirma.yetkili_telefon && (
                      <Text size="sm">📞 {varsayilanFirma.yetkili_telefon}</Text>
                    )}
                    {varsayilanFirma.imza_yetkisi && (
                      <Text size="xs" c="dimmed" fs="italic">
                        &quot;{varsayilanFirma.imza_yetkisi}&quot;
                      </Text>
                    )}
                  </SimpleGrid>
                </>
              )}
            </Stack>
          </SimpleGrid>

          {/* Ekstra Alanlar */}
          <Divider my="sm" />
          <Box>
            <Group
              justify="space-between"
              style={{ cursor: 'pointer' }}
              onClick={() => setEkstraAlanlarExpanded(!ekstraAlanlarExpanded)}
            >
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="indigo">
                  <IconPlus size={12} />
                </ThemeIcon>
                <Text size="sm" fw={500}>
                  Ek Bilgiler ({Object.keys(ekstraAlanlar).length})
                </Text>
              </Group>
              <ActionIcon variant="subtle" size="sm">
                <IconChevronDown
                  size={14}
                  style={{
                    transform: ekstraAlanlarExpanded ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                />
              </ActionIcon>
            </Group>

            <Collapse in={ekstraAlanlarExpanded}>
              <Stack gap="xs" mt="sm">
                {Object.entries(ekstraAlanlar).map(([key, value]) => (
                  <Group
                    key={key}
                    justify="space-between"
                    p="xs"
                    style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 6 }}
                  >
                    <Text size="sm">
                      <Text span fw={500} tt="capitalize">
                        {key.replace(/_/g, ' ')}:
                      </Text>{' '}
                      {String(value)}
                    </Text>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => handleDeleteEkstraAlan(key)}
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                ))}

                <Group gap="xs" mt="xs">
                  <Select
                    placeholder="Şablon seç veya manuel yaz..."
                    data={alanSablonlari.map((s) => ({ value: s.alan_adi, label: s.gorunen_ad }))}
                    value={
                      newAlanAdi && alanSablonlari.find((s) => s.alan_adi === newAlanAdi)
                        ? newAlanAdi
                        : null
                    }
                    onChange={(val) => {
                      if (val) setNewAlanAdi(val);
                    }}
                    searchable
                    clearable
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    placeholder="Alan adı (örn: sgk_sicil_no)"
                    value={newAlanAdi}
                    onChange={(e) => {
                      const val = e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '');
                      setNewAlanAdi(val);
                    }}
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    placeholder="Değer"
                    value={newAlanDeger}
                    onChange={(e) => setNewAlanDeger(e.target.value)}
                    size="xs"
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="xs"
                    variant="light"
                    color="indigo"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => handleAddEkstraAlan(newAlanAdi, newAlanDeger)}
                    disabled={!newAlanAdi || !newAlanDeger}
                  >
                    Ekle
                  </Button>
                </Group>

                <Group gap={4} mt="xs">
                  {alanSablonlari
                    .slice(0, 6)
                    .filter((s) => !ekstraAlanlar[s.alan_adi])
                    .map((sablon) => (
                      <Badge
                        key={sablon.alan_adi}
                        size="xs"
                        variant="outline"
                        color="gray"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setNewAlanAdi(sablon.alan_adi)}
                      >
                        + {sablon.gorunen_ad}
                      </Badge>
                    ))}
                </Group>
              </Stack>
            </Collapse>
          </Box>
        </Paper>
      ) : (
        <Paper p="xl" radius="md" withBorder ta="center">
          <IconBuilding
            size={48}
            color="var(--mantine-color-gray-5)"
            style={{ marginBottom: 16 }}
          />
          <Text c="dimmed" mb="md">
            Henüz firma bilgisi eklenmemiş
          </Text>
          <Button
            variant="light"
            color="teal"
            leftSection={<IconBuilding size={16} />}
            onClick={() => handleOpenFirmaModal()}
          >
            Firma Bilgilerini Ekle
          </Button>
        </Paper>
      )}
    </div>
  );
}
