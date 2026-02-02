'use client';

import { Badge, Group, Paper, Text, ThemeIcon } from '@mantine/core';
import { IconBuilding, IconMapPin, IconRefresh, IconStarFilled } from '@tabler/icons-react';
import type { Tender } from '@/types/api';
import type { SavedTender } from '../types';

interface TenderListItemProps {
  tender: Tender | SavedTender;
  isSelected: boolean;
  isTracked: boolean;
  onClick: () => void;
}

// Helper to check if tender is SavedTender
function isSavedTender(tender: Tender | SavedTender): tender is SavedTender {
  return 'tender_id' in tender;
}

// Calculate days remaining
function getDaysRemaining(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  try {
    let date: Date;
    // Handle different date formats
    if (dateStr.includes('/') || dateStr.includes('.')) {
      const parts = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
      if (!parts) return null;
      date = new Date(parseInt(parts[3], 10), parseInt(parts[2], 10) - 1, parseInt(parts[1], 10));
    } else {
      date = new Date(dateStr);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  } catch {
    return null;
  }
}

// Get urgency badge
function getUrgencyBadge(daysRemaining: number | null) {
  if (daysRemaining === null) return null;

  if (daysRemaining < 0) {
    return (
      <Badge size="xs" color="gray" variant="light">
        Geçmiş
      </Badge>
    );
  }
  if (daysRemaining === 0) {
    return (
      <Badge size="xs" color="red" variant="filled">
        BUGÜN
      </Badge>
    );
  }
  if (daysRemaining === 1) {
    return (
      <Badge size="xs" color="orange" variant="filled">
        YARIN
      </Badge>
    );
  }
  if (daysRemaining <= 3) {
    return (
      <Badge size="xs" color="yellow" variant="light">
        {daysRemaining} gün
      </Badge>
    );
  }
  if (daysRemaining <= 7) {
    return (
      <Badge size="xs" color="lime" variant="light">
        {daysRemaining} gün
      </Badge>
    );
  }
  return null;
}

export function TenderListItem({ tender, isSelected, isTracked, onClick }: TenderListItemProps) {
  const isSaved = isSavedTender(tender);

  // Extract common fields
  const title = isSaved ? tender.ihale_basligi : tender.title;
  const organization = isSaved ? tender.kurum : tender.organization;
  const city = tender.city;
  const dateStr = isSaved ? tender.tarih : tender.deadline;
  const externalId = isSaved ? tender.external_id : tender.external_id;

  // Calculate days remaining
  const daysRemaining = getDaysRemaining(dateStr);
  const urgencyBadge = getUrgencyBadge(daysRemaining);
  const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;

  // Status for saved tenders
  const status = isSaved ? tender.status : null;

  // Check if updated today (for "Güncellendi" badge)
  const isUpdatedToday = (() => {
    // Check is_updated flag from API
    if ('is_updated' in tender && tender.is_updated) return true;

    // Or check updated_at date
    const updatedAt = 'updated_at' in tender ? tender.updated_at : null;
    if (!updatedAt) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updateDate = new Date(updatedAt as string);
    updateDate.setHours(0, 0, 0, 0);
    return updateDate.getTime() === today.getTime();
  })();

  return (
    <Paper
      p="xs"
      radius="md"
      mb={4}
      withBorder
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: isSelected
          ? 'var(--mantine-color-blue-5)'
          : isUrgent
            ? 'var(--mantine-color-orange-4)'
            : 'var(--mantine-color-default-border)',
        borderWidth: isSelected ? 2 : 1,
        background: isSelected ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-body)',
        transition: 'all 0.15s ease',
      }}
      className="tender-list-item"
    >
      {/* Top row: Title + Tracked indicator */}
      <Group justify="space-between" gap={4} wrap="nowrap" mb={4}>
        <Group gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
            {title || 'İsimsiz İhale'}
          </Text>
          {isUpdatedToday && (
            <Badge size="xs" color="orange" variant="filled" leftSection={<IconRefresh size={8} />}>
              Güncellendi
            </Badge>
          )}
        </Group>
        {isTracked && (
          <ThemeIcon size="xs" color="yellow" variant="transparent">
            <IconStarFilled size={12} />
          </ThemeIcon>
        )}
      </Group>

      {/* Organization */}
      {organization && (
        <Group gap={4} wrap="nowrap" mb={2}>
          <IconBuilding size={12} color="var(--mantine-color-gray-6)" />
          <Text size="xs" c="dimmed" lineClamp={1}>
            {organization}
          </Text>
        </Group>
      )}

      {/* Bottom row: City, Date, Status badges */}
      <Group gap={4} wrap="wrap" mt={4}>
        {city && (
          <Badge size="xs" variant="light" color="blue" leftSection={<IconMapPin size={8} />}>
            {city}
          </Badge>
        )}
        {urgencyBadge}
        {status && isSaved && (
          <Badge size="xs" variant="dot" color={getStatusColor(status)}>
            {getStatusLabel(status)}
          </Badge>
        )}
      </Group>

      {/* External ID */}
      {externalId && (
        <Text size="xs" c="dimmed" mt={4}>
          #{externalId}
        </Text>
      )}
    </Paper>
  );
}

// Status helpers
function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    inceleniyor: 'cyan',
    bekliyor: 'yellow',
    basvuruldu: 'blue',
    kazanildi: 'green',
    kaybedildi: 'red',
    iptal: 'gray',
  };
  return colors[status] || 'gray';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    inceleniyor: 'İnceleniyor',
    bekliyor: 'Bekliyor',
    basvuruldu: 'Başvuruldu',
    kazanildi: 'Kazanıldı',
    kaybedildi: 'Kaybedildi',
    iptal: 'İptal',
  };
  return labels[status] || status;
}
