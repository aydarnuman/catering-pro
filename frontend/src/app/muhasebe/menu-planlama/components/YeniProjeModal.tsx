'use client';

import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { API_BASE_URL } from '@/lib/config';
import { useMenuPlanlama } from './MenuPlanlamaContext';

interface YeniProjeModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ProjeForm {
  ad: string;
  musteri: string;
  lokasyon: string;
  gunluk_kisi_sayisi: number;
  ogun_sayisi: string;
}

export function YeniProjeModal({ opened, onClose }: YeniProjeModalProps) {
  const queryClient = useQueryClient();
  const { setSelectedProjeId } = useMenuPlanlama();

  const form = useForm<ProjeForm>({
    initialValues: {
      ad: '',
      musteri: '',
      lokasyon: '',
      gunluk_kisi_sayisi: 500,
      ogun_sayisi: '3',
    },
    validate: {
      ad: (value) => (!value.trim() ? 'Proje adı zorunlu' : null),
    },
  });

  const createProjeMutation = useMutation({
    mutationFn: async (values: ProjeForm) => {
      const res = await fetch(`${API_BASE_URL}/api/projeler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: values.ad.trim(),
          musteri: values.musteri.trim() || null,
          lokasyon: values.lokasyon.trim() || null,
          gunluk_kisi_sayisi: values.gunluk_kisi_sayisi,
          ogun_sayisi: parseInt(values.ogun_sayisi, 10),
          durum: 'aktif',
          baslangic_tarihi: new Date().toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Proje oluşturulamadı');
      return data.data;
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Başarılı',
        message: 'Proje oluşturuldu',
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['projeler-aktif'] });
      setSelectedProjeId(data.id);
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Hata',
        message: error.message || 'Proje oluşturulamadı',
        color: 'red',
      });
    },
  });

  const handleSubmit = form.onSubmit((values) => {
    createProjeMutation.mutate(values);
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Yeni Proje Oluştur"
      size="md"
      styles={{
        title: { fontWeight: 600 },
      }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label="Proje Adı"
            placeholder="ör: ABC İnşaat Şantiye"
            required
            {...form.getInputProps('ad')}
          />

          <TextInput
            label="Müşteri / İşveren"
            placeholder="ör: ABC İnşaat A.Ş."
            {...form.getInputProps('musteri')}
          />

          <TextInput
            label="Lokasyon"
            placeholder="ör: İstanbul / Kadıköy"
            {...form.getInputProps('lokasyon')}
          />

          <NumberInput
            label="Günlük Kişi Sayısı"
            placeholder="500"
            min={1}
            max={10000}
            {...form.getInputProps('gunluk_kisi_sayisi')}
          />

          <div>
            <Text size="sm" fw={500} mb={4}>
              Öğün Sayısı
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { label: '2 Öğün (Öğle + Akşam)', value: '2' },
                { label: '3 Öğün (Kahvaltı + Öğle + Akşam)', value: '3' },
              ]}
              {...form.getInputProps('ogun_sayisi')}
            />
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              İptal
            </Button>
            <Button
              type="submit"
              loading={createProjeMutation.isPending}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan' }}
            >
              Proje Oluştur
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
