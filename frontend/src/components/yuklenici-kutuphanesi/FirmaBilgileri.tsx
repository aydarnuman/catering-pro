'use client';

/**
 * Yüklenici İletişim Bilgileri — Manuel girilebilir firma iletişim ve kimlik bilgileri.
 * ProfilModal içinde, Genel Bilgiler collapse'ı altında gösterilir.
 * NOT: "Şirket Kimliği" istihbarat modülü (MERSIS/Ticaret Sicil otomatik veriler) ile karıştırılmamalıdır.
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconCheck,
  IconEdit,
  IconMail,
  IconMapPin,
  IconPhone,
  IconReceipt,
  IconUser,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { Yuklenici } from '@/types/yuklenici';

interface Props {
  yuklenici: Yuklenici;
  onUpdate: (updated: Partial<Yuklenici>) => void;
}

interface FirmaField {
  key: keyof Yuklenici;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  type?: 'text' | 'textarea';
}

const FIELDS: FirmaField[] = [
  {
    key: 'yetkili_kisi',
    label: 'Yetkili Kişi',
    icon: <IconUser size={14} />,
    placeholder: 'Ad Soyad',
  },
  {
    key: 'telefon',
    label: 'Telefon',
    icon: <IconPhone size={14} />,
    placeholder: '0XXX XXX XX XX',
  },
  { key: 'email', label: 'E-posta', icon: <IconMail size={14} />, placeholder: 'info@firma.com' },
  {
    key: 'adres',
    label: 'Adres',
    icon: <IconMapPin size={14} />,
    placeholder: 'Firma adresi',
    type: 'textarea',
  },
  {
    key: 'vergi_no',
    label: 'Vergi No',
    icon: <IconReceipt size={14} />,
    placeholder: 'Vergi numarası',
  },
  {
    key: 'web_sitesi',
    label: 'Web Sitesi',
    icon: <IconWorld size={14} />,
    placeholder: 'https://firma.com',
  },
  {
    key: 'sektor',
    label: 'Sektör',
    icon: <IconBuilding size={14} />,
    placeholder: 'Toplu yemek / Catering',
  },
];

export function YukleniciIletisimBilgileri({ yuklenici, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const hasAnyData = FIELDS.some((f) => yuklenici[f.key]);

  const startEditing = useCallback(() => {
    const initial: Record<string, string> = {};
    for (const f of FIELDS) {
      initial[f.key] = (yuklenici[f.key] as string) || '';
    }
    setForm(initial);
    setEditing(true);
  }, [yuklenici]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setForm({});
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      // Sadece değişen alanları gönder
      const changed: Record<string, string | null> = {};
      for (const f of FIELDS) {
        const newVal = form[f.key]?.trim() || null;
        const oldVal = (yuklenici[f.key] as string) || null;
        if (newVal !== oldVal) {
          changed[f.key] = newVal;
        }
      }

      if (Object.keys(changed).length === 0) {
        setEditing(false);
        return;
      }

      const res = await fetch(getApiUrl(`/api/contractors/${yuklenici.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(changed),
      });

      if (!res.ok) throw new Error('Güncelleme başarısız');

      const data = await res.json();
      onUpdate(data.data);
      setEditing(false);
      notifications.show({
        title: 'Kaydedildi',
        message: 'İletişim bilgileri güncellendi',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'İletişim bilgileri kaydedilemedi',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [form, yuklenici, onUpdate]);

  return (
    <Card
      radius="md"
      p="sm"
      style={{
        background: 'var(--yk-surface-glass)',
        border: '1px solid var(--yk-border-subtle)',
      }}
    >
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconBuilding size={16} style={{ color: 'var(--yk-gold)' }} />
          <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>
            Yüklenici İletişim Bilgileri
          </Text>
          {!hasAnyData && !editing && (
            <Badge size="xs" variant="light" color="gray">
              Henüz girilmemiş
            </Badge>
          )}
        </Group>
        {!editing ? (
          <Tooltip label="Düzenle">
            <ActionIcon variant="subtle" size="sm" onClick={startEditing}>
              <IconEdit size={14} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="filled"
              color="green"
              leftSection={<IconCheck size={12} />}
              loading={saving}
              onClick={save}
            >
              Kaydet
            </Button>
            <ActionIcon variant="subtle" size="sm" color="gray" onClick={cancelEditing}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {editing ? (
        <Grid gutter="xs">
          {FIELDS.map((f) => (
            <Grid.Col key={`edit-${f.key}`} span={f.type === 'textarea' ? 12 : 6}>
              {f.type === 'textarea' ? (
                <Textarea
                  label={f.label}
                  placeholder={f.placeholder}
                  size="xs"
                  autosize
                  minRows={2}
                  maxRows={4}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  leftSection={f.icon}
                />
              ) : (
                <TextInput
                  label={f.label}
                  placeholder={f.placeholder}
                  size="xs"
                  value={form[f.key] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  leftSection={f.icon}
                />
              )}
            </Grid.Col>
          ))}
        </Grid>
      ) : hasAnyData ? (
        <Stack gap={4}>
          {FIELDS.filter((f) => yuklenici[f.key]).map((f) => (
            <Group key={`view-${f.key}`} gap="xs" wrap="nowrap">
              <Box style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>{f.icon}</Box>
              <Text size="xs" c="dimmed" style={{ flexShrink: 0, width: 80 }}>
                {f.label}:
              </Text>
              <Text
                size="xs"
                style={{
                  color: 'var(--yk-text-primary)',
                  wordBreak: 'break-word',
                }}
              >
                {f.key === 'web_sitesi' ? (
                  <a
                    href={String(yuklenici[f.key])}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--mantine-color-blue-5)', textDecoration: 'none' }}
                  >
                    {String(yuklenici[f.key])}
                  </a>
                ) : f.key === 'email' ? (
                  <a
                    href={`mailto:${String(yuklenici[f.key])}`}
                    style={{ color: 'var(--mantine-color-blue-5)', textDecoration: 'none' }}
                  >
                    {String(yuklenici[f.key])}
                  </a>
                ) : f.key === 'telefon' ? (
                  <a
                    href={`tel:${String(yuklenici[f.key])}`}
                    style={{ color: 'var(--mantine-color-blue-5)', textDecoration: 'none' }}
                  >
                    {String(yuklenici[f.key])}
                  </a>
                ) : (
                  String(yuklenici[f.key])
                )}
              </Text>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Card>
  );
}
