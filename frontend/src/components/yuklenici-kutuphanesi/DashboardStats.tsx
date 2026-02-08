'use client';

import { Card, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconActivity,
  IconBookmarkFilled,
  IconCash,
  IconCrown,
  IconDiscount,
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon
              size="sm"
              variant="light"
              color="yellow"
              radius="sm"
              style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}
            >
              <IconUsers size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Toplam Yuklenici
            </Text>
          </Group>
          <Text fw={700} size="xl" style={{ color: 'var(--yk-gold)' }}>
            {stats.genel.toplam_yuklenici}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon
              size="sm"
              variant="light"
              color="yellow"
              radius="sm"
              style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}
            >
              <IconBookmarkFilled size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Takipte
            </Text>
          </Group>
          <Text fw={700} size="xl" style={{ color: 'var(--yk-gold-light)' }}>
            {stats.genel.takipte_olan}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="green" radius="sm">
              <IconActivity size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Aktif Yuklenici
            </Text>
          </Group>
          <Text fw={700} size="xl" c="green">
            {stats.genel.aktif_yuklenici}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon
              size="sm"
              variant="light"
              color="yellow"
              radius="sm"
              style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}
            >
              <IconCash size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Pazar Buyuklugu
            </Text>
          </Group>
          <Text fw={700} size="lg" style={{ color: 'var(--yk-gold)' }}>
            {stats.genel.toplam_pazar_buyuklugu
              ? formatCurrency(parseFloat(stats.genel.toplam_pazar_buyuklugu))
              : '-'}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="teal" radius="sm">
              <IconTargetArrow size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Ort. Kazanma
            </Text>
          </Group>
          <Text fw={700} size="xl" c="teal">
            %
            {stats.genel.ortalama_kazanma_orani
              ? parseFloat(stats.genel.ortalama_kazanma_orani).toFixed(1)
              : '0'}
          </Text>
        </Card>

        <Card p="sm" radius="md" className="yk-stat-card">
          <Group gap={6} mb={4}>
            <ThemeIcon size="sm" variant="light" color="grape" radius="sm">
              <IconDiscount size={12} />
            </ThemeIcon>
            <Text
              size="xs"
              c="dimmed"
              style={{ letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: 10 }}
            >
              Ort. Indirim
            </Text>
          </Group>
          <Text fw={700} size="xl" c="grape">
            %
            {stats.genel.ortalama_indirim
              ? parseFloat(stats.genel.ortalama_indirim).toFixed(1)
              : '0'}
          </Text>
        </Card>
      </div>

      {/* ─── Top Firmalar — B+C: sol accent çizgi + büyük numara ── */}
      {stats.top10.length > 0 && (() => {
        const top3 = stats.top10.slice(0, 3);
        const rest = stats.top10.slice(3);
        const accentColors = ['#C9A84C', '#9CA3AF', '#B87333']; // gold, silver, bronze

        return (
          <Card
            p="md"
            radius="md"
            mb="md"
            className="yk-stat-card"
            style={{ borderColor: 'var(--yk-border)' }}
          >
            <Group gap={8} mb="sm">
              <ThemeIcon
                size="sm"
                variant="light"
                color="yellow"
                radius="sm"
                style={{ background: 'var(--yk-gold-dim)', color: 'var(--yk-gold)' }}
              >
                <IconCrown size={14} />
              </ThemeIcon>
              <Text
                fw={600}
                size="sm"
                style={{
                  color: 'var(--yk-gold)',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                }}
              >
                En Buyuk Firmalar
              </Text>
            </Group>

            {/* 1-3: Büyük numara + sol accent çizgi */}
            <Stack gap={2} mb={rest.length > 0 ? 16 : 0}>
              {top3.map((firma, idx) => (
                <button
                  type="button"
                  key={firma.id}
                  className="yk-lb-row yk-lb-podium"
                  style={{ borderLeftColor: accentColors[idx], cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left', width: '100%', borderLeft: `3px solid ${accentColors[idx]}` }}
                  onClick={() => onOpenDetail(firma.id)}
                >
                  <span className="yk-lb-num" style={{ color: accentColors[idx] }}>
                    {idx + 1}
                  </span>
                  <div className="yk-lb-info">
                    <Tooltip label={firma.unvan} openDelay={400} multiline maw={300}>
                      <Text size="sm" fw={600} lineClamp={1} style={{ color: 'var(--yk-text-primary)' }}>
                        {firma.kisa_ad || firma.unvan}
                      </Text>
                    </Tooltip>
                  </div>
                  <Text size="sm" fw={700} style={{ flexShrink: 0, color: accentColors[idx] }}>
                    {firma.toplam_sozlesme_bedeli
                      ? formatCurrency(Number(firma.toplam_sozlesme_bedeli))
                      : '-'}
                  </Text>
                </button>
              ))}
            </Stack>

            {/* 4-25: Kompakt 2 kolonlu grid */}
            {rest.length > 0 && (
              <div className="yk-lb-grid">
                {rest.map((firma, idx) => (
                  <button
                    type="button"
                    key={firma.id}
                    className="yk-lb-row yk-lb-rest"
                    style={{ cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left', width: '100%' }}
                    onClick={() => onOpenDetail(firma.id)}
                  >
                    <span className="yk-lb-num-sm">{idx + 4}</span>
                    <Tooltip label={firma.unvan} openDelay={400} multiline maw={300}>
                      <Text size="xs" lineClamp={1} style={{ flex: 1, minWidth: 0, color: 'var(--yk-text-primary)' }}>
                        {firma.kisa_ad || firma.unvan}
                      </Text>
                    </Tooltip>
                    <Text size="xs" fw={500} style={{ flexShrink: 0, color: 'var(--yk-text-secondary)' }}>
                      {firma.toplam_sozlesme_bedeli
                        ? formatCurrency(Number(firma.toplam_sozlesme_bedeli))
                        : '-'}
                    </Text>
                  </button>
                ))}
              </div>
            )}
          </Card>
        );
      })()}
    </>
  );
}
