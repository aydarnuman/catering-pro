'use client';

import {
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconCalendar, IconMapPin, IconSearch, IconSpy } from '@tabler/icons-react';
import type { YukleniciIhale, KazanilanIhale } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';

export function IhaleGecmisiTab({
  ihaleler,
  kazanilanIhaleler,
  totalIhaleler,
  filtreSehir,
  setFiltreSehir,
  filtreDurum,
  setFiltreDurum,
  filtreYil,
  setFiltreYil,
  search,
  setSearch,
}: {
  ihaleler: YukleniciIhale[];
  kazanilanIhaleler: KazanilanIhale[];
  totalIhaleler?: number;
  filtreSehir: string | null;
  setFiltreSehir: (v: string | null) => void;
  filtreDurum: string | null;
  setFiltreDurum: (v: string | null) => void;
  filtreYil: string | null;
  setFiltreYil: (v: string | null) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  if (ihaleler.length === 0 && kazanilanIhaleler.length === 0) {
    return (
      <Stack align="center" py="xl" gap="md" pb="md">
        <ThemeIcon size={64} variant="light" color="red" radius="xl">
          <IconSpy size={32} />
        </ThemeIcon>
        <div style={{ textAlign: 'center' }}>
          <Text fw={600} size="md" mb={4}>Ihale gecmisi henuz cekilmedi</Text>
          <Text size="sm" c="dimmed" maw={400}>
            Yuklenici detay sayfasindaki istihbarat butonuna (casus ikonu) basarak ihale gecmisi, analiz verisi ve katilimci bilgilerini otomatik olarak cekin.
          </Text>
        </div>
      </Stack>
    );
  }

  // Sehir listesini olustur (her iki kaynaktan)
  const sehirSet = new Set<string>();
  ihaleler.forEach((i) => { if (i.sehir) sehirSet.add(i.sehir); });
  kazanilanIhaleler.forEach((i) => { if (i.city) sehirSet.add(i.city); });
  const sehirOptions = Array.from(sehirSet).sort().map((s) => ({ value: s, label: s }));

  // Yil listesini olustur
  const yilSet = new Set<string>();
  ihaleler.forEach((i) => {
    if (i.sozlesme_tarihi) {
      yilSet.add(new Date(i.sozlesme_tarihi).getFullYear().toString());
    }
  });
  kazanilanIhaleler.forEach((i) => {
    const tarih = i.sozlesme_tarihi || i.tender_date;
    if (tarih) yilSet.add(new Date(tarih).getFullYear().toString());
  });
  const yilOptions = Array.from(yilSet).sort((a, b) => Number(b) - Number(a)).map((y) => ({ value: y, label: y }));

  // Durum listesini veriden olustur
  const durumGroupMap: Record<string, string> = {
    tamamlandi: 'tamamlandi', completed: 'tamamlandi', sonuclandi: 'tamamlandi',
    devam: 'devam', devam_ediyor: 'devam', active: 'devam',
    iptal: 'iptal', cancelled: 'iptal',
    bilinmiyor: 'bilinmiyor',
  };
  const durumGroupLabels: Record<string, string> = {
    tamamlandi: 'Tamamlandi', devam: 'Devam Ediyor', iptal: 'Iptal', bilinmiyor: 'Bilinmiyor',
  };
  const durumLabelMap: Record<string, string> = {
    tamamlandi: 'Tamamlandi', devam: 'Devam Ediyor', devam_ediyor: 'Devam Ediyor',
    iptal: 'Iptal', bilinmiyor: 'Bilinmiyor', completed: 'Tamamlandi', active: 'Aktif',
    sonuclandi: 'Sonuclandi', cancelled: 'Iptal',
  };

  const durumCountMap = new Map<string, number>();
  ihaleler.forEach((i) => {
    if (i.durum) {
      const group = durumGroupMap[i.durum] || i.durum;
      durumCountMap.set(group, (durumCountMap.get(group) || 0) + 1);
    }
  });
  kazanilanIhaleler.forEach((i) => {
    if (i.status) {
      const group = durumGroupMap[i.status] || i.status;
      durumCountMap.set(group, (durumCountMap.get(group) || 0) + 1);
    }
  });
  const durumOptions = Array.from(durumCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([d, count]) => ({
      value: d,
      label: `${durumGroupLabels[d] || durumLabelMap[d] || d} (${count})`,
    }));

  const validDurumValues = new Set(durumOptions.map((o) => o.value));
  const effectiveDurum = filtreDurum && validDurumValues.has(filtreDurum) ? filtreDurum : null;

  // Filtreleme
  const lowerSearch = search.toLowerCase();
  const filteredIhaleler = ihaleler.filter((i) => {
    if (filtreSehir && i.sehir !== filtreSehir) return false;
    if (effectiveDurum) {
      const iDurum = i.durum ? (durumGroupMap[i.durum] || i.durum) : '';
      if (iDurum !== effectiveDurum) return false;
    }
    if (filtreYil && i.sozlesme_tarihi && !i.sozlesme_tarihi.startsWith(filtreYil)) return false;
    if (lowerSearch) {
      const baslik = (i.ihale_basligi || '').toLowerCase();
      const kurum = (i.kurum_adi || '').toLowerCase();
      if (!baslik.includes(lowerSearch) && !kurum.includes(lowerSearch)) return false;
    }
    return true;
  });

  const filteredKazanilanIhaleler = kazanilanIhaleler.filter((i) => {
    if (filtreSehir && i.city !== filtreSehir) return false;
    if (effectiveDurum) {
      const iDurum = i.status ? (durumGroupMap[i.status] || i.status) : '';
      if (iDurum !== effectiveDurum) return false;
    }
    if (filtreYil) {
      const tarih = i.sozlesme_tarihi || i.tender_date;
      if (tarih && !tarih.startsWith(filtreYil)) return false;
    }
    if (lowerSearch) {
      if (!i.title.toLowerCase().includes(lowerSearch) && !i.organization_name.toLowerCase().includes(lowerSearch)) return false;
    }
    return true;
  });

  const totalFiltered = filteredIhaleler.length + filteredKazanilanIhaleler.length;
  const totalAll = (totalIhaleler ?? ihaleler.length) + kazanilanIhaleler.length;
  const hasActiveFilter = filtreSehir || effectiveDurum || filtreYil || search;

  const clearFilters = () => {
    setFiltreSehir(null);
    setFiltreDurum(null);
    setFiltreYil(null);
    setSearch('');
  };

  return (
    <Stack gap="md" pb="md">
      {/* Header */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text size="sm" fw={600}>
            {hasActiveFilter ? `${totalFiltered} / ${totalAll}` : totalAll} ihale kaydi
          </Text>
          {hasActiveFilter && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={clearFilters}>
              Temizle
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">Istihbarat butonuyla guncellenir</Text>
      </Group>

      {/* Filtreler */}
      <Group grow>
        <TextInput
          placeholder="Ihale veya kurum ara..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="xs"
        />
        <Select
          placeholder="Sehir"
          data={sehirOptions}
          value={filtreSehir}
          onChange={setFiltreSehir}
          clearable
          size="xs"
          leftSection={<IconMapPin size={14} />}
        />
        <Select
          placeholder="Durum"
          data={durumOptions}
          value={filtreDurum}
          onChange={setFiltreDurum}
          clearable
          size="xs"
        />
        <Select
          placeholder="Yil"
          data={yilOptions}
          value={filtreYil}
          onChange={setFiltreYil}
          clearable
          size="xs"
          leftSection={<IconCalendar size={14} />}
        />
      </Group>

      {/* Ihale Listesi */}
      <ScrollArea h={340}>
        <Stack gap={6}>
          {filteredIhaleler.map((ihale) => (
            <Paper key={`ib-${ihale.id}`} withBorder p="sm" radius="sm">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} lineClamp={1}>{ihale.ihale_basligi || ''}</Text>
                  <Group gap="xs" mt={4}>
                    {ihale.sehir && <Badge size="xs" variant="light" color="blue">{ihale.sehir}</Badge>}
                    {ihale.kurum_adi && <Text size="xs" c="dimmed" lineClamp={1}>{ihale.kurum_adi}</Text>}
                    {ihale.durum && (
                      <Badge
                        size="xs"
                        variant="light"
                        color={ihale.durum === 'tamamlandi' ? 'green' : ihale.durum === 'devam' ? 'blue' : ihale.durum === 'iptal' ? 'red' : 'gray'}
                      >
                        {ihale.durum.replace('_', ' ')}
                      </Badge>
                    )}
                    {ihale.fesih_durumu && ihale.fesih_durumu !== 'Yok' && (
                      <Badge size="xs" variant="filled" color="red">Fesih</Badge>
                    )}
                  </Group>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {ihale.sozlesme_bedeli > 0 && (
                    <Text size="sm" fw={600} c="orange">{formatCurrency(ihale.sozlesme_bedeli)}</Text>
                  )}
                  {ihale.indirim_orani > 0 && (
                    <Text size="xs" c="green">%{Number(ihale.indirim_orani).toFixed(1)} indirim</Text>
                  )}
                  {ihale.sozlesme_tarihi && (
                    <Text size="xs" c="dimmed">{new Date(ihale.sozlesme_tarihi).toLocaleDateString('tr-TR')}</Text>
                  )}
                </div>
              </Group>
            </Paper>
          ))}

          {filteredKazanilanIhaleler.map((ihale) => (
            <Paper
              key={`db-${ihale.id}`}
              withBorder
              p="sm"
              radius="sm"
              style={{ cursor: ihale.url ? 'pointer' : undefined, borderLeft: '3px solid var(--mantine-color-green-6)' }}
              onClick={() => { if (ihale.url) window.open(ihale.url, '_blank'); }}
            >
              <Group justify="space-between" wrap="nowrap">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={4}>
                    <Text size="sm" fw={600} lineClamp={1}>{ihale.title}</Text>
                    <Badge size="xs" variant="filled" color="green">Kazanildi</Badge>
                  </Group>
                  <Group gap="xs" mt={4}>
                    {ihale.city && <Badge size="xs" variant="light" color="blue">{ihale.city}</Badge>}
                    {ihale.organization_name && <Text size="xs" c="dimmed" lineClamp={1}>{ihale.organization_name}</Text>}
                  </Group>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {ihale.sozlesme_bedeli && (
                    <Text size="sm" fw={600} c="orange">{formatCurrency(ihale.sozlesme_bedeli)}</Text>
                  )}
                  {ihale.indirim_orani && (
                    <Text size="xs" c="green">%{Number(ihale.indirim_orani).toFixed(1)} indirim</Text>
                  )}
                  {(ihale.sozlesme_tarihi || ihale.tender_date) && (
                    <Text size="xs" c="dimmed">
                      {new Date(ihale.sozlesme_tarihi || ihale.tender_date).toLocaleDateString('tr-TR')}
                    </Text>
                  )}
                </div>
              </Group>
            </Paper>
          ))}

          {totalFiltered === 0 && hasActiveFilter && (
            <Stack align="center" py="lg" gap="xs">
              <IconSearch size={32} opacity={0.3} />
              <Text c="dimmed" size="sm">Filtrelere uyan ihale bulunamadi</Text>
              <Button size="xs" variant="light" color="gray" onClick={clearFilters}>
                Filtreleri Temizle
              </Button>
            </Stack>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
