'use client';

import { ActionIcon, Badge, Group, Paper, Text, Tooltip } from '@mantine/core';
import {
  IconBuilding,
  IconMapPin,
  IconRefresh,
  IconStar,
  IconStarFilled,
} from '@tabler/icons-react';
import type { Tender } from '@/types/api';
import type { SavedTender } from '../types';

interface TenderListItemProps {
  tender: Tender | SavedTender;
  isSelected: boolean;
  isTracked: boolean;
  onClick: () => void;
  onToggleTracking?: (tenderId: number, isCurrentlyTracked: boolean) => void;
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
      <Badge
        size="xs"
        variant="light"
        style={{ background: 'rgba(128, 128, 128, 0.1)', color: 'var(--mantine-color-gray-5)' }}
      >
        Geçmiş
      </Badge>
    );
  }
  if (daysRemaining === 0) {
    return (
      <Badge
        size="xs"
        variant="light"
        style={{
          background: 'rgba(220, 53, 69, 0.15)',
          color: '#dc3545',
          border: '1px solid rgba(220, 53, 69, 0.3)',
        }}
      >
        BUGÜN
      </Badge>
    );
  }
  if (daysRemaining === 1) {
    return (
      <Badge
        size="xs"
        variant="light"
        style={{
          background: 'rgba(201, 162, 39, 0.15)',
          color: '#C9A227',
          border: '1px solid rgba(201, 162, 39, 0.3)',
        }}
      >
        YARIN
      </Badge>
    );
  }
  if (daysRemaining <= 3) {
    return (
      <Badge
        size="xs"
        variant="light"
        style={{ background: 'rgba(201, 162, 39, 0.1)', color: '#C9A227' }}
      >
        {daysRemaining} gün
      </Badge>
    );
  }
  if (daysRemaining <= 7) {
    return (
      <Badge
        size="xs"
        variant="light"
        style={{ background: 'rgba(100, 149, 237, 0.1)', color: 'var(--mantine-color-gray-5)' }}
      >
        {daysRemaining} gün
      </Badge>
    );
  }
  return null;
}

export function TenderListItem({
  tender,
  isSelected,
  isTracked,
  onClick,
  onToggleTracking,
}: TenderListItemProps) {
  const isSaved = isSavedTender(tender);

  // Get tender ID for tracking toggle
  const tenderId = isSaved ? tender.tender_id : tender.id;

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
          ? 'rgba(100, 149, 237, 0.5)'
          : isUrgent
            ? 'rgba(201, 162, 39, 0.4)'
            : 'var(--mantine-color-default-border)',
        borderWidth: isSelected ? 1.5 : 1,
        background: isSelected ? 'rgba(100, 149, 237, 0.08)' : 'var(--mantine-color-body)',
        boxShadow: isSelected ? '0 0 12px rgba(100, 149, 237, 0.15)' : 'none',
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
            <Badge
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={8} />}
              style={{
                background: 'rgba(201, 162, 39, 0.15)',
                color: '#C9A227',
                border: '1px solid rgba(201, 162, 39, 0.3)',
              }}
            >
              Güncellendi
            </Badge>
          )}
        </Group>
        <Tooltip label={isTracked ? 'Takipten çıkar' : 'Takibe ekle'} withArrow>
          <ActionIcon
            size="xs"
            variant="transparent"
            color={isTracked ? 'yellow' : 'gray'}
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click
              onToggleTracking?.(tenderId, isTracked);
            }}
          >
            {isTracked ? <IconStarFilled size={14} /> : <IconStar size={14} />}
          </ActionIcon>
        </Tooltip>
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
          <Badge
            size="xs"
            variant="light"
            leftSection={<IconMapPin size={8} />}
            style={{
              background: 'rgba(100, 149, 237, 0.1)',
              color: 'var(--mantine-color-gray-5)',
              border: 'none',
            }}
          >
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
