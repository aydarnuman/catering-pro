'use client';

import { Box, Loader, Text } from '@mantine/core';
import mammoth from 'mammoth';
import { useCallback, useEffect, useRef, useState } from 'react';

interface DocxViewerProps {
  url: string;
  /** Fallback: Çıkarılmış metin (mammoth başarısız olursa gösterilir) */
  extractedText?: string;
  /** Text selection callback */
  onTextSelect?: (text: string) => void;
}

export function DocxViewer({ url, extractedText, onTextSelect }: DocxViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocx() {
      setLoading(true);
      setError(null);
      setUseFallback(false);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) {
          setHtml(result.value);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        // mammoth başarısız — extractedText varsa fallback göster
        if (extractedText && extractedText.trim().length > 20) {
          const isHtml = /<[a-z][\s\S]*>/i.test(extractedText);
          setHtml(
            isHtml
              ? extractedText
              : extractedText
                  .split('\n\n')
                  .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
                  .join(''),
          );
          setUseFallback(true);
          setLoading(false);
        } else {
          setError(err instanceof Error ? err.message : 'DOCX yüklenemedi');
          setLoading(false);
        }
      }
    }

    loadDocx();
    return () => {
      cancelled = true;
    };
  }, [url, extractedText]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      onTextSelect?.(selection.toString().trim());
    }
  }, [onTextSelect]);

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="sm" />
        <Text size="xs" c="dimmed" mt="xs">
          DOCX dosyası yükleniyor...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box ta="center" py="xl">
        <Text size="sm" c="red">
          Dosya açılamadı
        </Text>
        <Text size="xs" c="dimmed" mt="xs">
          Dosya formatı uyumsuz olabilir. İndirip masaüstünde açmayı deneyin.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onMouseUp={handleMouseUp}
      p="md"
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--mantine-color-dark-8)',
      }}
    >
      {useFallback && (
        <Box mb="xs" ta="center">
          <Text size="xs" c="yellow" fw={500}>
            Orijinal format okunamadı — çıkarılmış metin gösteriliyor
          </Text>
        </Box>
      )}
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Mammoth output is safe HTML from DOCX
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  );
}
