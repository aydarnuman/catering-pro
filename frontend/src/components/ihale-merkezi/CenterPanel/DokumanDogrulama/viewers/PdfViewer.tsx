'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconFileText, IconMinus, IconPlus } from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// PDF.js worker ayarı
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ViewMode = 'pdf' | 'text';

interface PdfViewerProps {
  url: string;
  targetPage?: number;
  onPageChange?: (page: number) => void;
  /** OCR/çıkarılmış metin (taranmış PDF'ler için) */
  ocrText?: string;
}

/** PDF.js getPage return type */
interface PdfPageProxy {
  getTextContent: () => Promise<{ items: unknown[] }>;
}

export function PdfViewer({ url, targetPage, onPageChange, ocrText }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(targetPage || 1);
  const [scale, setScale] = useState<number>(1.0);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('pdf');
  const [isScannedPdf, setIsScannedPdf] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    (pdf: { numPages: number; getPage: (n: number) => Promise<PdfPageProxy> }) => {
      setNumPages(pdf.numPages);
      setLoading(false);
      if (targetPage && targetPage <= pdf.numPages) {
        setPageNumber(targetPage);
      }
      // İlk sayfanın text content'ini kontrol et — taranmış mı?
      if (ocrText) {
        pdf.getPage(1).then((page) => {
          page.getTextContent().then((content) => {
            if (content.items.length === 0) {
              setIsScannedPdf(true);
            }
          });
        });
      }
    },
    [targetPage, ocrText]
  );

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message || 'PDF yüklenemedi');
    setLoading(false);
  }, []);

  const goToPage = useCallback(
    (page: number) => {
      const newPage = Math.max(1, Math.min(page, numPages));
      setPageNumber(newPage);
      onPageChange?.(newPage);
    },
    [numPages, onPageChange]
  );

  // targetPage değiştiğinde sayfayı güncelle
  if (targetPage && targetPage !== pageNumber && targetPage <= numPages) {
    setPageNumber(targetPage);
  }

  const hasOcrFallback = isScannedPdf && !!ocrText;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Üst Toolbar ──────────────────────────────────── */}
      <Paper p="xs" withBorder radius={0} style={{ flexShrink: 0 }}>
        <Group justify="space-between">
          <Group gap="xs">
            {viewMode === 'pdf' ? (
              <>
                <Tooltip label="Önceki sayfa">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    disabled={pageNumber <= 1}
                    onClick={() => goToPage(pageNumber - 1)}
                  >
                    <IconChevronLeft size={16} />
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" c="dimmed">
                  {pageNumber} / {numPages || '?'}
                </Text>
                <Tooltip label="Sonraki sayfa">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    disabled={pageNumber >= numPages}
                    onClick={() => goToPage(pageNumber + 1)}
                  >
                    <IconChevronRight size={16} />
                  </ActionIcon>
                </Tooltip>
              </>
            ) : (
              <Badge size="xs" variant="light" color="cyan" leftSection={<IconFileText size={10} />}>
                OCR Metin — Seçim yapabilirsiniz
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            {hasOcrFallback && (
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(val) => setViewMode(val as ViewMode)}
                data={[
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Metin', value: 'text' },
                ]}
                styles={{ root: { background: 'var(--mantine-color-dark-6)' } }}
              />
            )}
            {viewMode === 'pdf' && (
              <>
                <Tooltip label="Küçült">
                  <ActionIcon variant="subtle" size="sm" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}>
                    <IconMinus size={14} />
                  </ActionIcon>
                </Tooltip>
                <Text size="xs" c="dimmed" w={40} ta="center">
                  {Math.round(scale * 100)}%
                </Text>
                <Tooltip label="Büyüt">
                  <ActionIcon variant="subtle" size="sm" onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}>
                    <IconPlus size={14} />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
          </Group>
        </Group>
      </Paper>

      {/* ─── İçerik Alanı ─────────────────────────────────── */}
      {viewMode === 'text' && ocrText ? (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <Box
            p="md"
            style={{
              maxWidth: 800,
              margin: '0 auto',
              fontSize: 14,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              userSelect: 'text',
              cursor: 'text',
            }}
          >
            {ocrText}
          </Box>
        </ScrollArea>
      ) : (
        <Box
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            background: 'var(--mantine-color-dark-8)',
            padding: '8px 0',
            position: 'relative',
          }}
        >
          {error ? (
            <Box ta="center" py="xl">
              <Text size="sm" c="red">
                {error}
              </Text>
            </Box>
          ) : (
            <Document
              file={url}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <Box ta="center" py="xl">
                  <Loader size="sm" />
                  <Text size="xs" c="dimmed" mt="xs">
                    PDF yükleniyor...
                  </Text>
                </Box>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer
                renderAnnotationLayer
                loading={
                  <Box ta="center" py="lg">
                    <Loader size="xs" />
                  </Box>
                }
              />
            </Document>
          )}

          {isScannedPdf && (
            <Box
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              <Badge
                size="sm"
                variant="filled"
                color="yellow"
                style={{ cursor: 'pointer' }}
                onClick={() => setViewMode('text')}
              >
                Taranmış PDF — Metin seçmek için &quot;Metin&quot; görünümüne geçin
              </Badge>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
