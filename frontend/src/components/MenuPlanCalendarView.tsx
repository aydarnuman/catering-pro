'use client';

import { Alert, Box, Button, Group, Modal, Select, Stack, Text, NumberInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCalendar, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';
import MenuCalendar from './MenuCalendar';

interface MenuPlanOgun {
  id: number;
  tarih: string;
  ogun_tipi_id: number;
  ogun_tip_adi: string;
  ogun_ikon: string;
  kisi_sayisi: number;
  toplam_maliyet?: number;
  yemekler?: Array<{
    id: number;
    recete_adi: string;
  }>;
}

interface OgunTipi {
  id: number;
  kod: string;
  ad: string;
  ikon: string;
}

interface MenuPlanCalendarViewProps {
  menuPlanId: number;
  ogunler: MenuPlanOgun[];
  ogunTipleri: OgunTipi[];
  varsayilanKisiSayisi: number;
  onOgunEkle: (data: { tarih: Date; ogun_tipi_id: number; kisi_sayisi: number }) => Promise<void>;
  onOgunClick: (ogun: MenuPlanOgun) => void;
  isLoading?: boolean;
}

export default function MenuPlanCalendarView({
  menuPlanId,
  ogunler,
  ogunTipleri,
  varsayilanKisiSayisi,
  onOgunEkle,
  onOgunClick,
  isLoading = false,
}: MenuPlanCalendarViewProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedOgunTipi, setSelectedOgunTipi] = useState<string | null>(null);
  const [kisiSayisi, setKisiSayisi] = useState<number>(varsayilanKisiSayisi);
  const [isSaving, setIsSaving] = useState(false);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setKisiSayisi(varsayilanKisiSayisi);
    setSelectedOgunTipi(null);
    open();
  };

  const handleOgunEkle = async () => {
    if (!selectedDate || !selectedOgunTipi) {
      notifications.show({
        title: 'Eksik Bilgi',
        message: 'Lütfen tarih ve öğün tipi seçin',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    try {
      setIsSaving(true);
      await onOgunEkle({
        tarih: selectedDate,
        ogun_tipi_id: Number(selectedOgunTipi),
        kisi_sayisi: kisiSayisi,
      });

      notifications.show({
        title: 'Başarılı',
        message: 'Öğün planlandı',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      close();
    } catch (error: any) {
      // Çakışma hatası kontrolü
      if (error.response?.data?.conflict) {
        notifications.show({
          title: 'Çakışma',
          message: error.response.data.error || 'Bu öğün zaten planlanmış',
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      } else {
        notifications.show({
          title: 'Hata',
          message: error.response?.data?.error || 'Öğün eklenirken hata oluştu',
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Box>
        <Alert icon={<IconCalendar size={16} />} title="Takvim Görünümü" color="blue" mb="md">
          Bir tarihe tıklayarak hızlıca öğün ekleyebilirsiniz. Mevcut öğünlere tıklayarak detayları görebilirsiniz.
        </Alert>

        <MenuCalendar
          ogunler={ogunler}
          onDateClick={handleDateClick}
          onEventClick={onOgunClick}
          height={700}
        />
      </Box>

      {/* Hızlı Öğün Ekleme Modal */}
      <Modal opened={opened} onClose={close} title="Hızlı Öğün Ekle" size="md">
        <Stack>
          <DatePickerInput
            label="Tarih"
            placeholder="Tarih seçin"
            value={selectedDate}
            onChange={setSelectedDate}
            locale="tr"
            clearable
            disabled
          />

          <Select
            label="Öğün Tipi"
            placeholder="Öğün tipi seçin"
            value={selectedOgunTipi}
            onChange={setSelectedOgunTipi}
            data={ogunTipleri.map((ot) => ({
              value: String(ot.id),
              label: `${ot.ikon} ${ot.ad}`,
            }))}
            required
          />

          <NumberInput
            label="Kişi Sayısı"
            placeholder="Kişi sayısı"
            value={kisiSayisi}
            onChange={(val) => setKisiSayisi(Number(val) || varsayilanKisiSayisi)}
            min={1}
            max={100000}
            thousandSeparator="."
            required
          />

          <Text size="xs" c="dimmed">
            Öğünü oluşturduktan sonra yemek ekleyebilirsiniz.
          </Text>

          <Group justify="flex-end">
            <Button variant="light" onClick={close} disabled={isSaving}>
              İptal
            </Button>
            <Button onClick={handleOgunEkle} loading={isSaving}>
              Öğün Ekle
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
