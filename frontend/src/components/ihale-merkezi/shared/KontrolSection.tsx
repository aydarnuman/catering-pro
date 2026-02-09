'use client';

import {
  Badge,
  Box,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarDue,
  IconCash,
  IconChevronRight,
  IconCircleCheck,
  IconClipboardCheck,
  IconClock,
  IconFileCheck,
  IconFlag,
  IconReceipt,
  IconShieldCheck,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { firmalarAPI } from '@/lib/api/services/firmalar';
import type { Firma, SavedTender } from '../types';

interface CheckItem {
  id: string;
  label: string;
  category: 'belge' | 'mali' | 'teminat' | 'teknik' | 'teklif' | 'son_kontrol';
  autoDetected?: boolean; // AI tarafından tespit edildi mi
  detail?: string;
  firmaDaBelgeVar?: boolean; // Firmada bu belge mevcut mu
}

interface KontrolSectionProps {
  tender: SavedTender;
  firmalar?: Firma[];
  selectedFirmaId?: number | null;
}

export function KontrolSection({ tender, firmalar, selectedFirmaId }: KontrolSectionProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [firmaBelgeleri, setFirmaBelgeleri] = useState<string[]>([]);
  const [openModal, setOpenModal] = useState<string | null>(null);

  const storageKey = `kontrol_${tender.id}`;

  // localStorage'dan yükle
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCheckedItems(new Set(JSON.parse(saved)));
      } else {
        setCheckedItems(new Set());
      }
    } catch {
      setCheckedItems(new Set());
    }
  }, [storageKey]);

  // Seçili firma değiştiğinde belgelerini çek
  const activeFirmaId = selectedFirmaId || firmalar?.find((f) => f.varsayilan)?.id;
  useEffect(() => {
    if (!activeFirmaId) {
      setFirmaBelgeleri([]);
      return;
    }
    firmalarAPI
      .getDokumanlar(activeFirmaId)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          // belge_tipi ve dosya_adi listesi
          const belgeLabels = res.data.map((d: { belge_tipi?: string; dosya_adi?: string }) =>
            (d.belge_tipi || d.dosya_adi || '').toLowerCase()
          );
          setFirmaBelgeleri(belgeLabels);
        }
      })
      .catch(() => setFirmaBelgeleri([]));
  }, [activeFirmaId]);

  // localStorage'a kaydet
  const toggleItem = useCallback(
    (id: string) => {
      setCheckedItems((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    },
    [storageKey]
  );

  // Kalan gün hesapla
  const kalanGun = useMemo(() => {
    if (!tender.tarih) return null;
    const target = new Date(tender.tarih);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [tender.tarih]);

  // Türkçe-safe normalize: İ→i, Ş→s, Ğ→g, Ü→u, Ö→o, Ç→c, ı→i
  const normalizeTr = useCallback((str: string): string => {
    return str
      .toLowerCase()
      .replace(/İ/gi, 'i')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9 ]/g, '') // sadece ascii harf, rakam, boşluk
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Firma belge tipi → anahtar kelimeler (normalize edilmiş)
  const BELGE_TIPI_ESLESTIRME: Record<string, string[]> = useMemo(
    () => ({
      vergi_levhasi: ['vergi levha'],
      sicil_gazetesi: ['ticaret sicil', 'sicil gazete', 'sicil tastikname'],
      faaliyet_belgesi: ['faaliyet belge', 'oda kayit', 'odaya kayit', 'isletme kayit'],
      imza_sirkuleri: ['imza sirku', 'imza beyanname', 'noter tasdikli'],
      kapasite_raporu: ['kapasite rapor'],
      vekaletname: ['vekaletname', 'vekalet'],
      yetki_belgesi: ['yetki belge', 'yetkili oldug'],
      sgk_borcu_yoktur: ['sgk', 'sosyal guvenlik'],
      vergi_borcu_yoktur: ['vergi borcu'],
      bilanco: ['bilanco'],
      gelir_tablosu: ['gelir tablosu'],
      iso_9001: ['iso 9001', 'kalite yonetim'],
      iso_22000: ['iso 22000', 'gida guvenligi'],
      iso_sertifika: [
        'iso',
        'sertifika',
        'tse',
        'ts 8985',
        'ts 13075',
        'haccp',
        'helal',
        'hizmet yeri yeterlilik',
      ],
      haccp: ['haccp'],
      tse: ['tse'],
      gida_uretim_izni: ['gida uretim', 'uretim izin'],
      isletme_kayit: ['isletme kayit'],
      is_deneyim: ['is deneyim', 'is bitirme'],
      referans_mektup: ['referans mektub', 'referans'],
      sozlesme_sureti: ['sozlesme suret'],
      banka_referans: ['banka referans'],
      teklif_mektubu: ['teklif mektub'],
      gecici_teminat: ['gecici teminat'],
    }),
    []
  );

  // Firma belgesi eşleştirme yardımcısı
  const belgeFirmadaVar = useCallback(
    (label: string): boolean => {
      if (firmaBelgeleri.length === 0) return false;
      const labelNorm = normalizeTr(label);

      return firmaBelgeleri.some((fb) => {
        // 1. Direkt belge_tipi ile normalize Türkçe label eşleştir
        const eslestirmeler = BELGE_TIPI_ESLESTIRME[fb] || [];
        if (eslestirmeler.some((e) => labelNorm.includes(e))) return true;

        // 2. Belge tipi'ni normalize edip eşleştir (underscore → boşluk)
        const fbReadable = fb.replace(/_/g, ' ');
        if (labelNorm.includes(fbReadable) || fbReadable.includes(labelNorm.slice(0, 12)))
          return true;

        return false;
      });
    },
    [firmaBelgeleri, BELGE_TIPI_ESLESTIRME, normalizeTr]
  );

  // Dinamik checklist oluştur
  const checkItems = useMemo(() => {
    const items: CheckItem[] = [];
    const analysis = tender.analysis_summary;

    // ─── Gerekli Belgeler ───
    if (analysis?.gerekli_belgeler && analysis.gerekli_belgeler.length > 0) {
      for (const belge of analysis.gerekli_belgeler) {
        items.push({
          id: `belge_${belge.belge.slice(0, 30)}`,
          label: belge.belge,
          category: 'belge',
          autoDetected: true,
          detail: belge.zorunlu ? 'Zorunlu' : 'Opsiyonel',
          firmaDaBelgeVar: belgeFirmadaVar(belge.belge),
        });
      }
    } else {
      // Varsayılan belgeler
      const defaults = [
        { id: 'belge_is_deneyim', label: 'İş Deneyim Belgesi' },
        { id: 'belge_bilanco', label: 'Bilanço Bilgileri' },
        { id: 'belge_banka_ref', label: 'Banka Referans Mektubu' },
        { id: 'belge_ticaret_sicil', label: 'Ticaret Sicil Gazetesi' },
        { id: 'belge_imza_sirkuler', label: 'İmza Sirküleri' },
      ];
      for (const d of defaults) {
        items.push({
          ...d,
          category: 'belge',
          firmaDaBelgeVar: belgeFirmadaVar(d.label),
        });
      }
    }

    // ─── Mali Kriterler ───
    if (analysis?.mali_kriterler) {
      const mk = analysis.mali_kriterler;
      if (mk.cari_oran)
        items.push({
          id: 'mali_cari',
          label: `Cari Oran: ${mk.cari_oran}`,
          category: 'mali',
          autoDetected: true,
        });
      if (mk.ozkaynak_orani)
        items.push({
          id: 'mali_ozkaynak',
          label: `Özkaynak Oranı: ${mk.ozkaynak_orani}`,
          category: 'mali',
          autoDetected: true,
        });
      if (mk.is_deneyimi)
        items.push({
          id: 'mali_is_deneyim',
          label: `İş Deneyimi: ${mk.is_deneyimi}`,
          category: 'mali',
          autoDetected: true,
        });
      if (mk.ciro_orani)
        items.push({
          id: 'mali_ciro',
          label: `Ciro Oranı: ${mk.ciro_orani}`,
          category: 'mali',
          autoDetected: true,
        });
    }
    if (items.filter((i) => i.category === 'mali').length === 0) {
      items.push({ id: 'mali_yeterlik', label: 'Mali yeterlilik kontrolü', category: 'mali' });
    }

    // ─── Teminat ───
    if (analysis?.teminat_oranlari) {
      const t = analysis.teminat_oranlari;
      if (t.gecici)
        items.push({
          id: 'teminat_gecici',
          label: `Geçici Teminat: ${t.gecici}`,
          category: 'teminat',
          autoDetected: true,
        });
      if (t.kesin)
        items.push({
          id: 'teminat_kesin',
          label: `Kesin Teminat: ${t.kesin}`,
          category: 'teminat',
          autoDetected: true,
        });
    }
    if (items.filter((i) => i.category === 'teminat').length === 0) {
      items.push({
        id: 'teminat_gecici_default',
        label: 'Geçici teminat mektubu',
        category: 'teminat',
      });
    }

    // ─── Teknik İnceleme ───
    items.push({ id: 'teknik_sartname', label: 'Teknik şartname incelendi', category: 'teknik' });
    if (analysis?.ogun_bilgileri && analysis.ogun_bilgileri.length > 0) {
      items.push({
        id: 'teknik_menu',
        label: 'Menü planı hazırlandı',
        category: 'teknik',
        autoDetected: true,
      });
    }
    if (analysis?.personel_detaylari?.length || analysis?.personel_sayisi) {
      items.push({
        id: 'teknik_personel',
        label: 'Personel planı oluşturuldu',
        category: 'teknik',
        autoDetected: true,
      });
    }
    items.push({
      id: 'teknik_ekipman',
      label: 'Ekipman/malzeme listesi kontrol edildi',
      category: 'teknik',
    });

    // ─── Teklif Hazırlık ───
    items.push(
      { id: 'teklif_maliyet', label: 'Maliyet hesaplaması yapıldı', category: 'teklif' },
      { id: 'teklif_birim_fiyat', label: 'Birim fiyatlar belirlendi', category: 'teklif' },
      { id: 'teklif_cetvel', label: 'Teklif cetveli oluşturuldu', category: 'teklif' },
      { id: 'teklif_mektup', label: 'Teklif mektubu hazırlandı', category: 'teklif' },
      { id: 'teklif_kar_marji', label: 'Kâr marjı değerlendirildi', category: 'teklif' }
    );

    // ─── Son Kontrol ───
    items.push(
      { id: 'son_evrak_tam', label: 'Tüm evraklar tamam & imzalı', category: 'son_kontrol' },
      { id: 'son_zarf', label: 'Zarf hazırlandı & mühürlendi', category: 'son_kontrol' },
      { id: 'son_kopya', label: 'Suretler/kopyalar alındı', category: 'son_kontrol' },
      { id: 'son_teslim', label: 'Teslim edildi / kargoya verildi', category: 'son_kontrol' }
    );

    return items;
  }, [tender, belgeFirmadaVar]);

  const totalItems = checkItems.length;
  const completedItems = checkItems.filter((i) => checkedItems.has(i.id)).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const categories = [
    {
      key: 'belge' as const,
      label: 'Gerekli Belgeler',
      icon: <IconFileCheck size={14} />,
      color: 'blue',
    },
    {
      key: 'mali' as const,
      label: 'Mali Yeterlilik',
      icon: <IconCash size={14} />,
      color: 'green',
    },
    {
      key: 'teminat' as const,
      label: 'Teminat',
      icon: <IconShieldCheck size={14} />,
      color: 'violet',
    },
    {
      key: 'teknik' as const,
      label: 'Teknik İnceleme',
      icon: <IconToolsKitchen2 size={14} />,
      color: 'cyan',
    },
    {
      key: 'teklif' as const,
      label: 'Teklif Hazırlık',
      icon: <IconReceipt size={14} />,
      color: 'teal',
    },
    {
      key: 'son_kontrol' as const,
      label: 'Son Kontrol',
      icon: <IconClipboardCheck size={14} />,
      color: 'orange',
    },
  ];

  return (
    <Stack gap="md">
      {/* ─── Üst Özet: Süre + İlerleme ─── */}
      <Paper p="md" withBorder radius="md" bg="rgba(24, 24, 27, 0.5)">
        <Group justify="space-between" align="center">
          {/* İlerleme Ring */}
          <Group gap="md">
            <RingProgress
              size={64}
              thickness={6}
              roundCaps
              rootColor="var(--mantine-color-dark-5)"
              sections={[
                {
                  value: Math.max(progressPercent, 2), // min 2% for visibility
                  color:
                    progressPercent === 100 ? 'green' : progressPercent > 50 ? 'blue' : 'yellow',
                },
              ]}
              label={
                <Text ta="center" size="xs" fw={700}>
                  {progressPercent}%
                </Text>
              }
            />
            <div>
              <Text size="sm" fw={600}>
                {completedItems}/{totalItems} tamamlandı
              </Text>
              <Text size="xs" c="dimmed">
                Başvuru hazırlığı
              </Text>
            </div>
          </Group>

          {/* Kalan Gün */}
          {kalanGun !== null && (
            <Paper
              p="xs"
              px="md"
              radius="md"
              bg={
                kalanGun <= 0
                  ? 'rgba(255, 107, 107, 0.12)'
                  : kalanGun <= 3
                    ? 'rgba(255, 183, 77, 0.12)'
                    : kalanGun <= 7
                      ? 'rgba(255, 235, 59, 0.08)'
                      : 'rgba(81, 207, 102, 0.08)'
              }
              style={{
                borderColor:
                  kalanGun <= 0
                    ? 'var(--mantine-color-red-6)'
                    : kalanGun <= 3
                      ? 'var(--mantine-color-orange-6)'
                      : undefined,
                border: kalanGun <= 3 ? '1px solid' : undefined,
              }}
            >
              <Group gap={6}>
                {kalanGun <= 3 ? (
                  <IconAlertTriangle size={16} color="var(--mantine-color-orange-5)" />
                ) : (
                  <IconClock size={16} color="var(--mantine-color-dimmed)" />
                )}
                <div>
                  <Text
                    size="lg"
                    fw={700}
                    c={
                      kalanGun <= 0
                        ? 'red'
                        : kalanGun <= 3
                          ? 'orange'
                          : kalanGun <= 7
                            ? 'yellow'
                            : 'green'
                    }
                    lh={1}
                  >
                    {kalanGun <= 0 ? 'Geçti' : `${kalanGun} gün`}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {kalanGun <= 0 ? 'Süre doldu' : 'kaldı'}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
        </Group>

        {/* Progress bar */}
        <Progress
          value={progressPercent}
          size="sm"
          radius="xl"
          mt="md"
          color={progressPercent === 100 ? 'green' : progressPercent > 50 ? 'blue' : 'yellow'}
        />

        {/* Kompakt takvim bilgileri */}
        {(() => {
          const BELIRSIZ = [
            'sözleşme imzalandıktan sonra',
            'işe başlama tarihinden itibaren',
            'işe başlama tarihi',
            'sözleşme süresi',
          ];
          const filtered = tender.analysis_summary?.takvim?.filter((item) => {
            const olay = (item.olay || '').toLowerCase();
            const tarih = (item.tarih || '').toLowerCase();
            return !BELIRSIZ.some((b) => olay.includes(b) || tarih.includes(b));
          });
          if (!filtered || filtered.length === 0) return null;
          return (
            <>
              <Divider my="xs" />
              <Stack gap={4}>
                {filtered.slice(0, 5).map((item, idx) => {
                  const icons = [IconCalendarDue, IconClock, IconFlag];
                  const Icon = icons[idx % icons.length];
                  return (
                    <Group key={`${item.olay}_${item.tarih}`} gap={6} wrap="nowrap">
                      <Icon
                        size={13}
                        color="var(--mantine-color-dimmed)"
                        style={{ flexShrink: 0 }}
                      />
                      <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1 }}>
                        {item.olay}
                      </Text>
                      <Text size="xs" fw={500} c="blue.4" style={{ flexShrink: 0 }}>
                        {item.tarih}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </>
          );
        })()}
      </Paper>

      {/* ─── Kategorili Checklist (kompakt satır + modal) ─── */}
      {categories.map((cat) => {
        const catItems = checkItems.filter((i) => i.category === cat.key);
        if (catItems.length === 0) return null;
        const catCompleted = catItems.filter((i) => checkedItems.has(i.id)).length;
        const allDone = catCompleted === catItems.length;
        const isBelge = cat.key === 'belge';
        const firmaVarSayisi = isBelge ? catItems.filter((i) => i.firmaDaBelgeVar).length : 0;
        const eksikSayisi = isBelge && activeFirmaId ? catItems.length - firmaVarSayisi : 0;
        const firmaAdi = activeFirmaId
          ? firmalar?.find((f) => f.id === activeFirmaId)?.unvan
          : undefined;

        return (
          <Box key={cat.key}>
            {/* ── Kompakt özet satırı ── */}
            <UnstyledButton
              w="100%"
              onClick={() => setOpenModal(cat.key)}
              style={{ borderRadius: 8 }}
            >
              <Paper
                p="xs"
                px="sm"
                withBorder
                radius="md"
                style={{
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                styles={{
                  root: {
                    '&:hover': { background: 'rgba(255, 255, 255, 0.03)' },
                  },
                }}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Group gap={8} style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
                    <ThemeIcon
                      size={22}
                      variant="light"
                      color={allDone ? 'green' : cat.color}
                      radius="xl"
                    >
                      {allDone ? <IconCircleCheck size={12} /> : cat.icon}
                    </ThemeIcon>
                    <Text size="xs" fw={600} c={allDone ? 'green' : undefined}>
                      {cat.label}
                    </Text>
                  </Group>
                  <Group gap={6} wrap="nowrap">
                    <Badge size="xs" variant="light" color={allDone ? 'green' : 'gray'}>
                      {catCompleted}/{catItems.length}
                    </Badge>
                    {isBelge && activeFirmaId && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={eksikSayisi === 0 ? 'green' : 'orange'}
                      >
                        {eksikSayisi === 0 ? 'Tamam' : `${eksikSayisi} eksik`}
                      </Badge>
                    )}
                    <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
                  </Group>
                </Group>
              </Paper>
            </UnstyledButton>

            {/* ── Detay Modalı ── */}
            <Modal
              opened={openModal === cat.key}
              onClose={() => setOpenModal(null)}
              title={
                <Group gap="xs">
                  <ThemeIcon size="sm" variant="light" color={cat.color} radius="xl">
                    {cat.icon}
                  </ThemeIcon>
                  <Text fw={600} size="sm">
                    {cat.label} ({catItems.length})
                  </Text>
                </Group>
              }
              size="md"
              centered
              styles={{
                header: { paddingBottom: 8 },
                body: { paddingTop: 0 },
              }}
            >
              {/* Firma özeti - sadece belge kategorisi */}
              {isBelge && activeFirmaId && (
                <Paper
                  p="xs"
                  mb="sm"
                  radius="sm"
                  bg={eksikSayisi === 0 ? 'rgba(81, 207, 102, 0.08)' : 'rgba(255, 183, 77, 0.08)'}
                >
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {firmaAdi}
                  </Text>
                  <Text size="xs" fw={600} c={eksikSayisi === 0 ? 'green' : 'orange'}>
                    {firmaVarSayisi}/{catItems.length} belge firmada mevcut
                  </Text>
                </Paper>
              )}

              <ScrollArea.Autosize mah={400}>
                <Stack gap={2}>
                  {catItems.map((item) => (
                    <Group
                      key={item.id}
                      gap={8}
                      py={5}
                      px={8}
                      style={{
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: checkedItems.has(item.id)
                          ? 'rgba(81, 207, 102, 0.06)'
                          : item.firmaDaBelgeVar
                            ? 'rgba(81, 207, 102, 0.03)'
                            : undefined,
                      }}
                      onClick={() => toggleItem(item.id)}
                      wrap="nowrap"
                    >
                      <Checkbox
                        size="xs"
                        checked={checkedItems.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        color={checkedItems.has(item.id) ? 'green' : undefined}
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          size="xs"
                          td={checkedItems.has(item.id) ? 'line-through' : undefined}
                          c={checkedItems.has(item.id) ? 'dimmed' : undefined}
                        >
                          {item.label}
                        </Text>
                      </Box>
                      {isBelge && activeFirmaId && (
                        <Badge
                          size="xs"
                          variant="light"
                          color={item.firmaDaBelgeVar ? 'green' : 'red'}
                          style={{ flexShrink: 0 }}
                        >
                          {item.firmaDaBelgeVar ? 'Var' : 'Eksik'}
                        </Badge>
                      )}
                      {item.detail === 'Zorunlu' && (
                        <Badge size="xs" variant="light" color="red" style={{ flexShrink: 0 }}>
                          Zorunlu
                        </Badge>
                      )}
                      {item.autoDetected && (
                        <Text size="xs" c="teal" fw={700} style={{ flexShrink: 0 }}>
                          AI
                        </Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              </ScrollArea.Autosize>

              {/* Alt özet */}
              <Divider my="sm" />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {catCompleted}/{catItems.length} tamamlandı
                </Text>
                <Progress
                  value={
                    catItems.length > 0 ? Math.round((catCompleted / catItems.length) * 100) : 0
                  }
                  size="sm"
                  radius="xl"
                  w={120}
                  color={catCompleted === catItems.length ? 'green' : cat.color}
                />
              </Group>
            </Modal>
          </Box>
        );
      })}
    </Stack>
  );
}
