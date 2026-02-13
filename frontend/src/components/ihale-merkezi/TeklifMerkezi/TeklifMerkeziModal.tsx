'use client';

import {
  Box,
  Button,
  Divider,
  Group,
  Kbd,
  Loader,
  LoadingOverlay,
  Modal,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconArrowLeft, IconArrowRight, IconDeviceFloppy, IconX } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { useTeklifMerkezi } from './hooks/useTeklifMerkezi';
import { CetvelSection } from './sections/CetvelSection';
import { HesaplamalarSection } from './sections/HesaplamalarSection';
import { MaliyetSection } from './sections/MaliyetSection';
import { OzetSection } from './sections/OzetSection';
import { TespitSection } from './sections/TespitSection';
import { TeklifMerkeziSidebar } from './TeklifMerkeziSidebar';
import type { TeklifMerkeziModalProps, TeklifMerkeziSection } from './types';
import { SECTIONS } from './types';

const SECTION_ORDER: TeklifMerkeziSection[] = ['tespit', 'maliyet', 'hesaplamalar', 'cetvel', 'ozet'];

export function TeklifMerkeziModal({
  opened,
  onClose,
  tender,
  onRefresh,
  initialSection = 'tespit',
}: TeklifMerkeziModalProps) {
  const ctx = useTeklifMerkezi(tender, initialSection, onRefresh);
  const { activeSection, setActiveSection, loading, saving, isDirty, handleSave } = ctx;

  const currentIndex = SECTION_ORDER.indexOf(activeSection);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < SECTION_ORDER.length - 1;

  const goBack = useCallback(() => {
    if (canGoBack) setActiveSection(SECTION_ORDER[currentIndex - 1]);
  }, [canGoBack, currentIndex, setActiveSection]);

  const goForward = useCallback(() => {
    if (canGoForward) setActiveSection(SECTION_ORDER[currentIndex + 1]);
  }, [canGoForward, currentIndex, setActiveSection]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('Kaydedilmemiş değişiklikler var. Çıkmak istediğinize emin misiniz?');
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  // Keyboard shortcuts
  useHotkeys([
    [
      'ctrl+s',
      (e) => {
        e.preventDefault();
        handleSave();
      },
    ],
    [
      'mod+s',
      (e) => {
        e.preventDefault();
        handleSave();
      },
    ],
    ['alt+ArrowLeft', goBack],
    ['alt+ArrowRight', goForward],
  ]);

  const currentSectionInfo = useMemo(() => SECTIONS.find((s) => s.id === activeSection), [activeSection]);

  const renderSection = () => {
    switch (activeSection) {
      case 'tespit':
        return <TespitSection ctx={ctx} />;
      case 'maliyet':
        return <MaliyetSection ctx={ctx} />;
      case 'hesaplamalar':
        return <HesaplamalarSection ctx={ctx} />;
      case 'cetvel':
        return <CetvelSection ctx={ctx} />;
      case 'ozet':
        return <OzetSection ctx={ctx} />;
      default:
        return null;
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      fullScreen
      radius={0}
      transitionProps={{ transition: 'fade', duration: 200 }}
      withCloseButton={false}
      padding={0}
      styles={{
        body: {
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        },
        content: { background: 'var(--mantine-color-dark-8)' },
      }}
    >
      {/* ─── Header ─── */}
      <Box
        px="md"
        py={8}
        style={{
          borderBottom: '1px solid var(--mantine-color-dark-5)',
          background: 'var(--mantine-color-dark-7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Group gap="sm">
          <Text size="sm" fw={700} c="white">
            Teklif Merkezi
          </Text>
          <Divider orientation="vertical" />
          <Text size="xs" c="dimmed" lineClamp={1} maw={400}>
            {tender.ihale_basligi || 'İsimsiz İhale'}
          </Text>
        </Group>
        <Group gap="xs">
          {/* Nav prev/next */}
          <Tooltip label={`Önceki: ${canGoBack ? SECTIONS[currentIndex - 1]?.label : ''}`} disabled={!canGoBack}>
            <Button
              size="compact-xs"
              variant="subtle"
              disabled={!canGoBack}
              onClick={goBack}
              leftSection={<IconArrowLeft size={14} />}
            >
              Geri
            </Button>
          </Tooltip>
          <Text size="xs" c="dimmed">
            {currentIndex + 1} / {SECTION_ORDER.length}
          </Text>
          <Tooltip label={`Sonraki: ${canGoForward ? SECTIONS[currentIndex + 1]?.label : ''}`} disabled={!canGoForward}>
            <Button
              size="compact-xs"
              variant="subtle"
              disabled={!canGoForward}
              onClick={goForward}
              rightSection={<IconArrowRight size={14} />}
            >
              İleri
            </Button>
          </Tooltip>

          <Divider orientation="vertical" />

          {/* Save */}
          <Button
            size="compact-sm"
            variant={isDirty ? 'gradient' : 'light'}
            gradient={{ from: 'blue', to: 'cyan' }}
            leftSection={saving ? <Loader size={14} color="white" /> : <IconDeviceFloppy size={14} />}
            onClick={handleSave}
            loading={saving}
            disabled={!isDirty && !saving}
          >
            Kaydet
          </Button>

          {/* Close */}
          <Tooltip label="Kapat (kaydedilmemiş değişiklikler sorulur)">
            <Button size="compact-sm" variant="subtle" color="gray" onClick={handleClose}>
              <IconX size={16} />
            </Button>
          </Tooltip>
        </Group>
      </Box>

      {/* ─── Body ─── */}
      <Box style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <LoadingOverlay visible={loading} zIndex={100} overlayProps={{ blur: 2 }} />

        {/* Sidebar */}
        <Box
          w={280}
          style={{
            flexShrink: 0,
            borderRight: '1px solid var(--mantine-color-dark-5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TeklifMerkeziSidebar ctx={ctx} />
        </Box>

        {/* Content */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Section header */}
          <Box
            px="lg"
            py="xs"
            style={{
              borderBottom: '1px solid var(--mantine-color-dark-6)',
              background: 'var(--mantine-color-dark-7)',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between">
              <div>
                <Text size="md" fw={700}>
                  {currentSectionInfo?.label}
                </Text>
                <Text size="xs" c="dimmed">
                  {currentSectionInfo?.description}
                </Text>
              </div>
              <Group gap={4}>
                <Kbd size="xs">Ctrl+S</Kbd>
                <Text size="xs" c="dimmed">
                  kaydet
                </Text>
                <Text size="xs" c="dimmed" mx={4}>
                  •
                </Text>
                <Kbd size="xs">Alt+←→</Kbd>
                <Text size="xs" c="dimmed">
                  bölüm geçiş
                </Text>
              </Group>
            </Group>
          </Box>

          {/* Scrollable section content */}
          <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
            <Box p="lg" pb={100}>
              {renderSection()}
            </Box>
          </ScrollArea>

          {/* Footer nav */}
          <Box
            px="lg"
            py="xs"
            style={{
              borderTop: '1px solid var(--mantine-color-dark-6)',
              background: 'var(--mantine-color-dark-7)',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between">
              <Button
                variant="subtle"
                size="sm"
                leftSection={<IconArrowLeft size={16} />}
                disabled={!canGoBack}
                onClick={goBack}
              >
                {canGoBack ? SECTIONS[currentIndex - 1]?.label : ''}
              </Button>
              {activeSection === 'ozet' ? (
                <Button
                  variant="gradient"
                  gradient={{ from: 'green', to: 'teal' }}
                  size="sm"
                  leftSection={saving ? <Loader size={14} color="white" /> : <IconDeviceFloppy size={16} />}
                  onClick={handleSave}
                  loading={saving}
                >
                  Kaydet & Kapat
                </Button>
              ) : (
                <Button
                  variant="light"
                  size="sm"
                  rightSection={<IconArrowRight size={16} />}
                  disabled={!canGoForward}
                  onClick={goForward}
                >
                  {canGoForward ? SECTIONS[currentIndex + 1]?.label : ''}
                </Button>
              )}
            </Group>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
