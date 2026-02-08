'use client';

/**
 * Yapışkan Notlar (Sticker Notes) — Renkli, eklenip/silinebilen post-it benzeri notlar.
 * Her yüklenici için bağımsız not koleksiyonu. YukleniciModal'da gösterilir.
 */

import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconNote, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/config';
import type { YukleniciNot } from '@/types/yuklenici';

interface Props {
  yukleniciId: number;
}

type NotRenk = YukleniciNot['renk'];

const RENK_MAP: Record<NotRenk, { bg: string; border: string; text: string }> = {
  yellow: { bg: '#FFF9DB', border: '#FFE066', text: '#5C4813' },
  blue: { bg: '#E7F5FF', border: '#74C0FC', text: '#1864AB' },
  green: { bg: '#EBFBEE', border: '#69DB7C', text: '#2B8A3E' },
  pink: { bg: '#FFF0F6', border: '#F06595', text: '#A61E4D' },
  orange: { bg: '#FFF4E6', border: '#FFA94D', text: '#D9480F' },
  purple: { bg: '#F3F0FF', border: '#9775FA', text: '#5F3DC4' },
};

const RENK_OPTIONS: NotRenk[] = ['yellow', 'blue', 'green', 'pink', 'orange', 'purple'];

export function YapiskanNotlar({ yukleniciId }: Props) {
  const [notlar, setNotlar] = useState<YukleniciNot[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newIcerik, setNewIcerik] = useState('');
  const [newRenk, setNewRenk] = useState<NotRenk>('yellow');
  const [saving, setSaving] = useState(false);

  // Notları çek
  const fetchNotlar = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/api/contractors/${yukleniciId}/notlar`), {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setNotlar(data.data || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [yukleniciId]);

  useEffect(() => {
    fetchNotlar();
  }, [fetchNotlar]);

  // Yeni not ekle
  const handleAdd = useCallback(async () => {
    if (!newIcerik.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/contractors/${yukleniciId}/notlar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ icerik: newIcerik.trim(), renk: newRenk }),
      });
      if (!res.ok) throw new Error('Eklenemedi');
      const data = await res.json();
      setNotlar((prev) => [data.data, ...prev]);
      setNewIcerik('');
      setAdding(false);
      notifications.show({ message: 'Not eklendi', color: 'green' });
    } catch {
      notifications.show({ title: 'Hata', message: 'Not eklenemedi', color: 'red' });
    } finally {
      setSaving(false);
    }
  }, [yukleniciId, newIcerik, newRenk]);

  // Not sil
  const handleDelete = useCallback(
    async (notId: number) => {
      try {
        const res = await fetch(getApiUrl(`/api/contractors/${yukleniciId}/notlar/${notId}`), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Silinemedi');
        setNotlar((prev) => prev.filter((n) => n.id !== notId));
      } catch {
        notifications.show({ title: 'Hata', message: 'Not silinemedi', color: 'red' });
      }
    },
    [yukleniciId]
  );

  if (loading) return null;

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
          <IconNote size={16} style={{ color: 'var(--yk-gold)' }} />
          <Text size="sm" fw={600} style={{ color: 'var(--yk-gold)', letterSpacing: '0.02em' }}>
            Notlar
          </Text>
          {notlar.length > 0 && (
            <Text size="xs" c="dimmed">
              ({notlar.length})
            </Text>
          )}
        </Group>
        {!adding && (
          <Tooltip label="Not ekle">
            <ActionIcon variant="light" size="sm" color="yellow" onClick={() => setAdding(true)}>
              <IconPlus size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* Yeni not ekleme formu */}
      {adding && (
        <Card
          p="xs"
          mb="xs"
          radius="md"
          style={{
            background: RENK_MAP[newRenk].bg,
            border: `1.5px solid ${RENK_MAP[newRenk].border}`,
          }}
        >
          <Textarea
            placeholder="Not yaz..."
            size="xs"
            autosize
            minRows={2}
            maxRows={5}
            value={newIcerik}
            onChange={(e) => setNewIcerik(e.target.value)}
            styles={{
              input: {
                background: 'transparent',
                border: 'none',
                color: RENK_MAP[newRenk].text,
                fontWeight: 500,
                fontSize: '0.8rem',
              },
            }}
            autoFocus
          />
          <Group justify="space-between" mt={6}>
            {/* Renk seçici */}
            <Group gap={4}>
              {RENK_OPTIONS.map((r) => (
                <UnstyledButton
                  key={`renk-${r}`}
                  onClick={() => setNewRenk(r)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: RENK_MAP[r].bg,
                    border: `2px solid ${r === newRenk ? RENK_MAP[r].border : 'transparent'}`,
                    boxShadow: r === newRenk ? `0 0 0 1px ${RENK_MAP[r].border}` : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </Group>
            <Group gap={4}>
              <Button
                size="compact-xs"
                color="green"
                loading={saving}
                disabled={!newIcerik.trim()}
                onClick={handleAdd}
              >
                Ekle
              </Button>
              <ActionIcon
                variant="subtle"
                size="sm"
                color="gray"
                onClick={() => {
                  setAdding(false);
                  setNewIcerik('');
                }}
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          </Group>
        </Card>
      )}

      {/* Mevcut notlar */}
      {notlar.length > 0 ? (
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
          {notlar.map((not) => {
            const renk = RENK_MAP[not.renk] || RENK_MAP.yellow;
            return (
              <Box
                key={`not-${not.id}`}
                p="xs"
                style={{
                  background: renk.bg,
                  border: `1px solid ${renk.border}`,
                  borderRadius: 8,
                  position: 'relative',
                  minHeight: 60,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Silme butonu */}
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  color="gray"
                  style={{ position: 'absolute', top: 4, right: 4, opacity: 0.5 }}
                  onClick={() => handleDelete(not.id)}
                >
                  <IconTrash size={12} />
                </ActionIcon>

                <Text
                  size="xs"
                  style={{
                    color: renk.text,
                    fontWeight: 500,
                    whiteSpace: 'pre-line',
                    paddingRight: 16,
                    lineHeight: 1.45,
                  }}
                >
                  {not.icerik}
                </Text>

                <Text
                  size="xs"
                  mt={4}
                  style={{ color: renk.text, opacity: 0.5, fontSize: '0.65rem' }}
                >
                  {new Date(not.created_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Box>
            );
          })}
        </SimpleGrid>
      ) : !adding ? (
        <Text size="xs" c="dimmed" ta="center" py="xs">
          Henüz not eklenmemiş
        </Text>
      ) : null}
    </Card>
  );
}
