'use client';

import { Box, Loader, Text } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/config';

interface DocLegacyViewerProps {
  /** Döküman ID (backend convert endpoint için) */
  documentId: number;
  /** Zaten mevcut extracted text (varsa önce bunu göster) */
  extractedText?: string;
  /** Text selection callback */
  onTextSelect?: (text: string) => void;
}

/**
 * Eski .doc (binary Word) dosyaları için viewer.
 * Backend'deki convert endpoint'ini kullanarak HTML/text'e çevirir.
 * Fallback: extractedText veya ocrText prop'unu gösterir.
 */
export function DocLegacyViewer({ documentId, extractedText, onTextSelect }: DocLegacyViewerProps) {
  const [content, setContent] = useState<string>('');
  const [format, setFormat] = useState<'html' | 'text'>('text');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function convert() {
      setLoading(true);
      setError(null);

      // Zaten extracted text varsa hemen göster
      if (extractedText && extractedText.trim().length > 50) {
        const isHtml = /<[a-z][\s\S]*>/i.test(extractedText);
        setContent(extractedText);
        setFormat(isHtml ? 'html' : 'text');
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(getApiUrl(`/api/tender-docs/documents/${documentId}/convert`));
        if (cancelled) return;

        const data = res.data?.data;
        if (data?.html) {
          setContent(data.html);
          setFormat('html');
        } else if (data?.text) {
          setContent(data.text);
          setFormat('text');
        } else {
          setError('İçerik alınamadı');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Dosya dönüştürülemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    convert();
    return () => {
      cancelled = true;
    };
  }, [documentId, extractedText]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.toString().trim()) {
      onTextSelect?.(selection.toString().trim());
    }
  }, [onTextSelect]);

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="sm" />
        <Text size="xs" c="dimmed" mt="xs">
          DOC dosyası dönüştürülüyor...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box ta="center" py="xl">
        <Text size="sm" c="red">
          {error}
        </Text>
        <Text size="xs" c="dimmed" mt="xs">
          Bu dosya türü sunucu tarafında dönüştürülemedi.
        </Text>
      </Box>
    );
  }

  // Format: text → paragraflarla göster
  const htmlContent =
    format === 'html'
      ? content
      : content
          .split('\n\n')
          .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
          .join('');

  return (
    <Box
      onMouseUp={handleMouseUp}
      p="md"
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--mantine-color-dark-8)',
      }}
    >
      <Box
        style={{
          maxWidth: 800,
          margin: '0 auto',
          background: 'white',
          color: '#1a1a1a',
          padding: '40px 48px',
          borderRadius: 4,
          minHeight: '100%',
          fontSize: 14,
          lineHeight: 1.6,
        }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Content from backend convert endpoint
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </Box>
  );
}
