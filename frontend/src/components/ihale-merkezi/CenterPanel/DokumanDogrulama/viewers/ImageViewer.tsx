'use client';

import { ActionIcon, Box, Group, ScrollArea, Text, Tooltip } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

interface ImageViewerProps {
  url: string;
  /** OCR ile çıkarılan metin (varsa) */
  ocrText?: string;
  /** Text selection callback (OCR panelinden) */
  onTextSelect?: (text: string) => void;
}

export function ImageViewer({ url, ocrText, onTextSelect }: ImageViewerProps) {
  const [scale, setScale] = useState(1.0);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.toString().trim()) {
      onTextSelect?.(selection.toString().trim());
    }
  }, [onTextSelect]);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image */}
      <Box
        style={{
          flex: ocrText ? '0 0 60%' : '1 1 auto',
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: 'var(--mantine-color-dark-8)',
          padding: 8,
        }}
      >
        <Box style={{ position: 'relative' }}>
          <Group
            gap="xs"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 5,
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 6,
              padding: '2px 4px',
            }}
          >
            <Tooltip label="Küçült">
              <ActionIcon
                variant="transparent"
                size="xs"
                c="white"
                onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
              >
                <IconMinus size={12} />
              </ActionIcon>
            </Tooltip>
            <Text size="xs" c="white" w={32} ta="center">
              {Math.round(scale * 100)}%
            </Text>
            <Tooltip label="Büyüt">
              <ActionIcon
                variant="transparent"
                size="xs"
                c="white"
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              >
                <IconPlus size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {url ? (
            <img
              src={url}
              alt="Döküman görseli"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                maxWidth: scale <= 1 ? '100%' : 'none',
              }}
            />
          ) : (
            <Text size="sm" c="dimmed" p="xl">
              Görsel yüklenemedi
            </Text>
          )}
        </Box>
      </Box>

      {/* OCR Text panel */}
      {ocrText && (
        <Box
          style={{
            flex: '0 0 40%',
            borderTop: '1px solid var(--mantine-color-default-border)',
          }}
          onMouseUp={handleMouseUp}
        >
          <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" fw={600}>
              OCR Metin
            </Text>
          </Box>
          <ScrollArea style={{ height: 'calc(100% - 32px)' }} p="xs">
            <Text size="xs" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'monospace' }}>
              {ocrText}
            </Text>
          </ScrollArea>
        </Box>
      )}
    </Box>
  );
}
