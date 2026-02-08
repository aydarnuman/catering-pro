'use client';

import { Badge, Card, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconActivity,
  IconBookmarkFilled,
  IconCash,
  IconCrown,
  IconDiscount,
  IconMedal,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import type { StatsData } from '@/types/yuklenici';
import { formatCurrency } from '@/types/yuklenici';

export function DashboardStats({
  stats,
  onOpenDetail,
}: {
  stats: StatsData;
  onOpenDetail: (id: number) => void;
}) {
  return (
    <>
      {/* Genel istatistik kartlari — premium dark + gold */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="yellow" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
              <IconUsers size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Toplam Yuklenici</Text>
          </Group>
          <Text fw={700} size="xl" style={{ color: 'var(--yk-gold)' }}>{stats.genel.toplam_yuklenici}</Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="yellow" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
              <IconBookmarkFilled size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Takipte</Text>
          </Group>
          <Text fw={700} size="xl" style={{ color: 'var(--yk-gold-light)' }}>{stats.genel.takipte_olan}</Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="green" radius="sm">
              <IconActivity size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Aktif Yuklenici</Text>
          </Group>
          <Text fw={700} size="xl" c="green">{stats.genel.aktif_yuklenici}</Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="yellow" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
              <IconCash size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Pazar Buyuklugu</Text>
          </Group>
          <Text fw={700} size="lg" style={{ color: 'var(--yk-gold)' }}>
            {stats.genel.toplam_pazar_buyuklugu ? formatCurrency(parseFloat(stats.genel.toplam_pazar_buyuklugu)) : '-'}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="teal" radius="sm">
              <IconTargetArrow size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Ort. Kazanma</Text>
          </Group>
          <Text fw={700} size="xl" c="teal">
            %{stats.genel.ortalama_kazanma_orani ? parseFloat(stats.genel.ortalama_kazanma_orani).toFixed(1) : '0'}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="grape" radius="sm">
              <IconDiscount size={12} />
            </ThemeIcon>
            <Text size="xs" c="dimmed" style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}>Ort. Indirim</Text>
          </Group>
          <Text fw={700} size="xl" c="grape">
            %{stats.genel.ortalama_indirim ? parseFloat(stats.genel.ortalama_indirim).toFixed(1) : '0'}
          </Text>
        </Card>
      </div>

      {/* Top 10 Yuklenici — premium gold treatment */}
      {stats.top10.length > 0 && (
        <Card
          p="md"
          radius="md"
          mb="md"
          className="yk-stat-card"
          style={{ borderColor: 'var(--yk-border)' }}
        >
          <Group gap={8} mb="sm">
            <ThemeIcon size="sm" variant="light" color="yellow" radius="sm" style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}>
              <IconCrown size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm" style={{ color: 'var(--yk-gold)', letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 11 }}>
              En Buyuk 10 Yuklenici
            </Text>
          </Group>
          <Stack gap={4}>
            {stats.top10.map((firma, idx) => {
              const isPodium = idx < 3;
              return (
                <Group
                  key={firma.id}
                  justify="space-between"
                  wrap="nowrap"
                  py={6}
                  px={8}
                  className={isPodium ? 'yk-top10-podium' : 'yk-top10-row'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpenDetail(firma.id)}
                >
                  <Group gap={10} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    {isPodium ? (
                      <ThemeIcon
                        size="sm"
                        variant="filled"
                        radius="xl"
                        style={{
                          background: idx === 0
                            ? 'linear-gradient(135deg, #C9A84C, #D4B965)'
                            : idx === 1
                            ? 'linear-gradient(135deg, #9CA3AF, #C0C5CE)'
                            : 'linear-gradient(135deg, #B87333, #D4956A)',
                          color: '#000',
                        }}
                      >
                        <IconMedal size={12} />
                      </ThemeIcon>
                    ) : (
                      <Badge
                        size="sm"
                        variant="light"
                        circle
                        style={{
                          background: 'var(--yk-surface-glass)',
                          border: '1px solid var(--yk-border-subtle)',
                          color: 'var(--yk-text-secondary)',
                        }}
                      >
                        {idx + 1}
                      </Badge>
                    )}
                    <Tooltip label={firma.unvan} openDelay={400} multiline maw={300}>
                      <Text
                        size="xs"
                        lineClamp={1}
                        fw={isPodium ? 600 : 400}
                        style={isPodium ? { color: 'var(--yk-gold-light)' } : { color: 'var(--yk-text-primary)' }}
                      >
                        {firma.kisa_ad || firma.unvan}
                      </Text>
                    </Tooltip>
                  </Group>
                  <Text
                    size="xs"
                    fw={600}
                    style={{
                      flexShrink: 0,
                      color: isPodium ? 'var(--yk-gold)' : 'var(--yk-gold-light)',
                    }}
                  >
                    {firma.toplam_sozlesme_bedeli ? formatCurrency(Number(firma.toplam_sozlesme_bedeli)) : '-'}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </Card>
      )}
    </>
  );
}
