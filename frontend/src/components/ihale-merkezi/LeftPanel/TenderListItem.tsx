'use client';

import { ActionIcon, Badge, Box, Button, Collapse, Group, Paper, Text, Tooltip } from '@mantine/core';
import {
  IconBuilding,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCurrencyLira,
  IconDownload,
  IconFileText,
  IconGavel,
  IconList,
  IconMapPin,
  IconRefresh,
  IconStar,
  IconStarFilled,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import type { Tender } from '@/types/api';
import type { SavedTender } from '../types';

interface TenderListItemProps {
  tender: Tender | SavedTender;
  isSelected: boolean;
  isTracked: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onToggleExpand: () => void;
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
        Süresi dolmuş
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
      <Badge size="xs" variant="light" style={{ background: 'rgba(201, 162, 39, 0.1)', color: '#C9A227' }}>
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
  if (daysRemaining <= 30) {
    return (
      <Badge
        size="xs"
        variant="light"
        style={{ background: 'rgba(100, 149, 237, 0.06)', color: 'var(--mantine-color-gray-6)' }}
      >
        {daysRemaining} gün
      </Badge>
    );
  }
  return null;
}

// Document button config
const DOC_BUTTON_CONFIG: Record<
  string,
  { label: string; shortLabel: string; icon: typeof IconFileText; color: string }
> = {
  goods_list: { label: 'Malzeme Listesi', shortLabel: 'M', icon: IconList, color: 'teal' },
  announcement: { label: 'İhale İlanı', shortLabel: 'İ', icon: IconFileText, color: 'teal' },
  admin_spec: { label: 'İdari Şartname', shortLabel: 'İd', icon: IconFileText, color: 'teal' },
  tech_spec: { label: 'Teknik Şartname', shortLabel: 'T', icon: IconFileText, color: 'teal' },
  zeyilname: { label: 'Zeyilname', shortLabel: 'Z', icon: IconFileText, color: 'orange' },
  correction_notice: { label: 'Düzeltme İlanı', shortLabel: 'D', icon: IconFileText, color: 'red' },
  probable_participants: {
    label: 'Muhtemel Katılımcılar',
    shortLabel: 'K',
    icon: IconUsers,
    color: 'teal',
  },
  tender_document: { label: 'İhale Dokümanı', shortLabel: 'Do', icon: IconDownload, color: 'blue' },
  result_announcement: { label: 'Sonuç İlanı', shortLabel: 'Sİ', icon: IconTrophy, color: 'green' },
  contract_list: { label: 'Sözleşme Listesi', shortLabel: 'SL', icon: IconGavel, color: 'grape' },
};

const DOC_BUTTON_ORDER = [
  'goods_list',
  'announcement',
  'admin_spec',
  'tech_spec',
  'zeyilname',
  'correction_notice',
  'probable_participants',
  'tender_document',
  'result_announcement',
  'contract_list',
];

// Parse goods count from button name like "Malzeme Listesi 2", "Malzeme Listesi34", "Malzeme Listesi (13)"
function parseGoodsCount(name: string): number | null {
  // "Malzeme Listesi(13)" or "Malzeme Listesi (13)"
  const matchParen = name.match(/\((\d+)\)/);
  if (matchParen) return parseInt(matchParen[1], 10);
  // "Malzeme Listesi 2" or "Malzeme Listesi34" (no space)
  const matchEnd = name.match(/(\d+)\s*$/);
  if (matchEnd) return parseInt(matchEnd[1], 10);
  return null;
}

// Format date for display
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return dateStr;
  }
}

export function TenderListItem({
  tender,
  isSelected,
  isTracked,
  isExpanded,
  onClick,
  onToggleExpand,
  onToggleTracking,
}: TenderListItemProps) {
  const isSaved = isSavedTender(tender);

  // Get tender ID for tracking toggle
  const tenderId = isSaved ? tender.tender_id : tender.id;
  const internalId = isSaved ? tender.tender_id : tender.id;

  // Extract common fields
  const title = isSaved ? tender.ihale_basligi : tender.title;
  const organization = isSaved ? tender.kurum : tender.organization;
  const city = tender.city;
  const location = !isSaved ? tender.location : undefined;
  const cityDisplay = location && city ? `${location} / ${city}` : city;
  const dateStr = isSaved ? tender.tarih : tender.deadline;
  const externalId = isSaved ? tender.external_id : tender.external_id;

  // Fields only on Tender (not SavedTender)
  const publishDate = !isSaved ? tender.publish_date : undefined;
  const tenderMethod = !isSaved ? tender.tender_method : undefined;
  const tenderSource = !isSaved ? tender.tender_source : undefined;
  const bidType = !isSaved ? tender.bid_type : undefined;
  const goodsServicesCount = !isSaved ? tender.goods_services_count : undefined;

  // Sonuçlanan ihale bilgileri
  const yukleniciAdi = !isSaved ? tender.yuklenici_adi : undefined;
  const sozlesmeBedeli = !isSaved ? tender.sozlesme_bedeli : undefined;
  const indirimOrani = !isSaved ? tender.indirim_orani : undefined;
  const sozlesmeTarihi = !isSaved ? tender.sozlesme_tarihi : undefined;
  const isCompleted = (!isSaved && tender.status === 'completed') || !!yukleniciAdi;

  // Calculate days remaining
  const daysRemaining = getDaysRemaining(dateStr);
  const urgencyBadge = getUrgencyBadge(daysRemaining);
  const isUrgent = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;

  // Status for saved tenders
  const status = isSaved ? tender.status : null;

  // Check if updated today
  const isUpdatedToday = (() => {
    if ('is_updated' in tender && tender.is_updated) return true;
    const updatedAt = 'updated_at' in tender ? tender.updated_at : null;
    if (!updatedAt) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updateDate = new Date(updatedAt as string);
    updateDate.setHours(0, 0, 0, 0);
    return updateDate.getTime() === today.getTime();
  })();

  // Document buttons from document_links
  const docButtons = useMemo(() => {
    const links = (!isSaved ? tender.document_links : null) || {};
    return DOC_BUTTON_ORDER.filter((key) => key in links).map((key) => {
      const linkData = links[key];
      const config = DOC_BUTTON_CONFIG[key] || {
        label: key,
        shortLabel: '?',
        icon: IconFileText,
        color: 'gray',
      };
      const name = typeof linkData === 'object' && linkData !== null ? linkData.name : config.label;

      // For goods_list, try to get count
      let count: number | null = null;
      if (key === 'goods_list') {
        count = goodsServicesCount ?? parseGoodsCount(name || '');
      }

      // Always use config.label for clean display, append count for goods_list
      const displayLabel = count !== null ? `${config.label} (${count})` : config.label;

      const url = typeof linkData === 'object' && linkData !== null ? linkData.url : null;

      return {
        key,
        label: displayLabel,
        shortLabel: count !== null ? `${config.shortLabel}${count}` : config.shortLabel,
        icon: config.icon,
        color: config.color,
        url,
      };
    });
  }, [isSaved, tender, goodsServicesCount]);

  return (
    <Paper
      p="xs"
      radius="md"
      mb={4}
      withBorder
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
      {/* === ALWAYS VISIBLE: Compact View === */}
      <Box onClick={onClick}>
        {/* Top row: #id + Title + Güncellendi badge + expand/track */}
        <Group justify="space-between" gap={4} wrap="nowrap" mb={4}>
          <Group gap={6} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" fw={700} c="dimmed" style={{ flexShrink: 0 }}>
              #{internalId}
            </Text>
            <Text size="sm" fw={600} lineClamp={1} style={{ flex: 1 }}>
              {title || 'İsimsiz İhale'}
            </Text>
            {isUpdatedToday && (
              <Badge
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={8} />}
                style={{
                  background: 'rgba(40, 167, 69, 0.15)',
                  color: '#28a745',
                  border: '1px solid rgba(40, 167, 69, 0.3)',
                  flexShrink: 0,
                }}
              >
                Güncellendi
              </Badge>
            )}
          </Group>
          <Group gap={2} style={{ flexShrink: 0 }}>
            <ActionIcon
              size="xs"
              variant="transparent"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
            >
              {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </ActionIcon>
            <Tooltip label={isTracked ? 'Takipten çıkar' : 'Takibe ekle'} withArrow>
              <ActionIcon
                size="xs"
                variant="transparent"
                color={isTracked ? 'yellow' : 'gray'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTracking?.(tenderId, isTracked);
                }}
              >
                {isTracked ? <IconStarFilled size={14} /> : <IconStar size={14} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Organization */}
        {organization && (
          <Group gap={4} wrap="nowrap" mb={2}>
            <IconBuilding size={12} color="var(--mantine-color-gray-6)" style={{ flexShrink: 0 }} />
            <Text size="xs" c="dimmed" lineClamp={1}>
              {organization}
            </Text>
          </Group>
        )}

        {/* Bottom row: City + Urgency + Status + Mini doc indicators */}
        <Group gap={4} wrap="wrap" mt={4}>
          {cityDisplay && (
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
              {cityDisplay}
            </Badge>
          )}
          {isCompleted ? (
            <Badge
              size="xs"
              variant="light"
              leftSection={<IconCheck size={8} />}
              style={{
                background: 'rgba(40, 167, 69, 0.12)',
                color: '#28a745',
                border: '1px solid rgba(40, 167, 69, 0.25)',
              }}
            >
              Tamamlandı
            </Badge>
          ) : (
            urgencyBadge
          )}
          {status && isSaved && (
            <Badge size="xs" variant="dot" color={getStatusColor(status)}>
              {getStatusLabel(status)}
            </Badge>
          )}

          {/* Document count indicator (compact view) */}
          {!isExpanded && docButtons.length > 0 && (
            <Tooltip label={docButtons.map((b) => b.label).join(', ')} withArrow multiline>
              <Badge
                size="xs"
                variant="light"
                color="teal"
                leftSection={<IconFileText size={8} />}
                style={{ cursor: 'default', marginLeft: 'auto' }}
              >
                {docButtons.length} döküman
              </Badge>
            </Tooltip>
          )}
        </Group>
      </Box>

      {/* === EXPANDED VIEW: Full ihalebul.com details === */}
      <Collapse in={isExpanded}>
        <Box mt={8} pt={8} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }} onClick={onClick}>
          {/* İhale Kayıt No */}
          {externalId && (
            <Text size="xs" c="dimmed" mb={4}>
              İKN: {externalId}
            </Text>
          )}

          {/* Dates row */}
          <Group gap={8} mb={6}>
            {publishDate && (
              <Group gap={4} wrap="nowrap">
                <IconCalendar size={11} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed">
                  Yayın: {formatDate(publishDate)}
                </Text>
              </Group>
            )}
            {dateStr && (
              <Group gap={4} wrap="nowrap">
                <IconCalendar size={11} color={isUrgent ? '#C9A227' : 'var(--mantine-color-gray-5)'} />
                <Text size="xs" c={isUrgent ? 'yellow.6' : 'dimmed'} fw={isUrgent ? 600 : 400}>
                  Teklif: {formatDateTime(dateStr)}
                </Text>
              </Group>
            )}
            {daysRemaining !== null && daysRemaining >= 0 && (
              <Badge size="xs" variant="light" color={daysRemaining <= 3 ? 'red' : 'gray'}>
                {daysRemaining === 0 ? 'Bugün' : daysRemaining === 1 ? 'Yarın' : `${daysRemaining} gün kaldı`}
              </Badge>
            )}
          </Group>

          {/* Info badges: source, method, bid type */}
          <Group gap={4} mb={8} wrap="wrap">
            {tenderSource && (
              <Badge size="xs" variant="light" color="gray">
                {tenderSource}
              </Badge>
            )}
            {tenderMethod && (
              <Badge size="xs" variant="light" color="gray">
                {tenderMethod}
              </Badge>
            )}
            {bidType && (
              <Badge size="xs" variant="light" color="gray">
                {bidType}
              </Badge>
            )}
          </Group>

          {/* Sonuçlanan ihale bilgileri */}
          {yukleniciAdi && (
            <Box
              mb={8}
              p={6}
              style={{
                background: 'rgba(40, 167, 69, 0.06)',
                borderRadius: 6,
                border: '1px solid rgba(40, 167, 69, 0.15)',
              }}
            >
              <Group gap={4} wrap="nowrap" mb={4}>
                <IconTrophy size={12} color="#28a745" style={{ flexShrink: 0 }} />
                <Text size="xs" fw={600} c="green.7" lineClamp={1}>
                  {yukleniciAdi}
                </Text>
              </Group>
              <Group gap={8} wrap="wrap">
                {sozlesmeBedeli && (
                  <Group gap={3} wrap="nowrap">
                    <IconCurrencyLira size={11} color="var(--mantine-color-gray-6)" />
                    <Text size="xs" c="dimmed">
                      Sözleşme:{' '}
                      <Text span fw={600} c="green.7">
                        ₺{Number(sozlesmeBedeli).toLocaleString('tr-TR')}
                      </Text>
                    </Text>
                  </Group>
                )}
                {indirimOrani && (
                  <Badge size="xs" variant="filled" color="green" radius="sm">
                    %{Number(indirimOrani).toFixed(1)} indirim
                  </Badge>
                )}
                {sozlesmeTarihi && (
                  <Group gap={3} wrap="nowrap">
                    <IconCalendar size={10} color="var(--mantine-color-gray-5)" />
                    <Text size="xs" c="dimmed">
                      {formatDate(sozlesmeTarihi)}
                    </Text>
                  </Group>
                )}
              </Group>
            </Box>
          )}

          {/* Document button row - ihalebul.com style */}
          {docButtons.length > 0 && (
            <Group gap={4} wrap="wrap">
              {docButtons.map((btn) => {
                const IconComp = btn.icon;
                return (
                  <Button
                    key={btn.key}
                    size="compact-xs"
                    variant="light"
                    color={btn.color}
                    leftSection={<IconComp size={12} />}
                    component={btn.url ? 'a' : 'button'}
                    href={btn.url || undefined}
                    target={btn.url ? '_blank' : undefined}
                    rel={btn.url ? 'noopener noreferrer' : undefined}
                    style={{
                      fontSize: 11,
                      height: 24,
                      paddingLeft: 6,
                      paddingRight: 8,
                      textDecoration: 'none',
                    }}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!btn.url) onClick();
                    }}
                  >
                    {btn.label}
                  </Button>
                );
              })}
            </Group>
          )}
        </Box>
      </Collapse>
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
