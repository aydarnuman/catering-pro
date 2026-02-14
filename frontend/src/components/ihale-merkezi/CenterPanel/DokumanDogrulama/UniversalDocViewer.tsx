'use client';

import { Box, Loader, Text } from '@mantine/core';
import dynamic from 'next/dynamic';
import { DocLegacyViewer } from './viewers/DocLegacyViewer';
import { DocxViewer } from './viewers/DocxViewer';
import { HtmlViewer } from './viewers/HtmlViewer';
import { ImageViewer } from './viewers/ImageViewer';
import { XlsxViewer } from './viewers/XlsxViewer';

// react-pdf CSS
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const PdfViewer = dynamic(() => import('./viewers/PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <Box ta="center" py="xl">
      <Loader size="sm" />
      <Text size="xs" c="dimmed" mt="xs">
        PDF görüntüleyici yükleniyor...
      </Text>
    </Box>
  ),
});

// ─── Dosya türü tespit ──────────────────────────────────────────

export type DocFileType = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'image' | 'html' | 'unknown';

export function detectFileType(fileName?: string, mimeType?: string, sourceType?: string): DocFileType {
  if (sourceType === 'content' || sourceType === 'scraped') return 'html';
  const name = (fileName || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (name.endsWith('.pdf') || mime === 'application/pdf' || mime === 'pdf') return 'pdf';
  if (name.endsWith('.doc') && !name.endsWith('.docx')) return 'doc';
  if (
    name.endsWith('.docx') ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'docx'
  )
    return 'docx';
  if (mime === 'application/msword' || mime === 'doc') return 'doc';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  )
    return 'xlsx';
  if (
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.tiff') ||
    name.endsWith('.tif') ||
    name.endsWith('.gif') ||
    name.endsWith('.webp') ||
    name.endsWith('.bmp') ||
    mime.startsWith('image/')
  )
    return 'image';
  if (name.endsWith('.html') || name.endsWith('.htm') || mime === 'text/html') return 'html';
  return 'unknown';
}

// ─── Props ──────────────────────────────────────────────────────

interface UniversalDocViewerProps {
  url: string;
  documentId?: number;
  fileName?: string;
  mimeType?: string;
  sourceType?: string;
  contentText?: string;
  ocrText?: string;
  extractedText?: string;
  targetPage?: number;
  onTextSelect?: (text: string, pageNumber?: number) => void;
  onPageChange?: (page: number) => void;
}

export function UniversalDocViewer({
  url,
  documentId,
  fileName,
  mimeType,
  sourceType,
  contentText,
  ocrText,
  extractedText,
  targetPage,
  onTextSelect,
  onPageChange,
}: UniversalDocViewerProps) {
  const fileType = detectFileType(fileName, mimeType, sourceType);

  if (fileType === 'html' && contentText) {
    return <HtmlViewer content={contentText} onTextSelect={(text) => onTextSelect?.(text)} />;
  }

  switch (fileType) {
    case 'pdf':
      return (
        <PdfViewer url={url} targetPage={targetPage} onPageChange={onPageChange} ocrText={ocrText || extractedText} />
      );

    case 'docx':
      return (
        <DocxViewer url={url} extractedText={ocrText || extractedText} onTextSelect={(text) => onTextSelect?.(text)} />
      );

    case 'doc':
      if (documentId) {
        return (
          <DocLegacyViewer
            documentId={documentId}
            extractedText={ocrText || extractedText}
            onTextSelect={(text) => onTextSelect?.(text)}
          />
        );
      }
      if (ocrText || extractedText) {
        return <HtmlViewer content={ocrText || extractedText || ''} onTextSelect={(text) => onTextSelect?.(text)} />;
      }
      return (
        <Box ta="center" py="xl">
          <Text size="sm" c="dimmed">
            Eski Word formatı (.doc) doğrudan görüntülenemiyor.
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            Döküman henüz işlenmemiş veya metin çıkarılamamış.
          </Text>
        </Box>
      );

    case 'xlsx':
      return <XlsxViewer url={url} onTextSelect={(text) => onTextSelect?.(text)} />;

    case 'image':
      return <ImageViewer url={url} ocrText={ocrText} onTextSelect={(text) => onTextSelect?.(text)} />;

    case 'html':
      return (
        <Box ta="center" py="xl">
          <Text size="sm" c="dimmed">
            HTML dosyası doğrudan görüntülenemiyor. İndirmek için bağlantıyı kullanın.
          </Text>
        </Box>
      );

    default:
      if (ocrText || extractedText) {
        return <HtmlViewer content={ocrText || extractedText || ''} onTextSelect={(text) => onTextSelect?.(text)} />;
      }
      if (documentId) {
        return <DocLegacyViewer documentId={documentId} onTextSelect={(text) => onTextSelect?.(text)} />;
      }
      return (
        <Box ta="center" py="xl">
          <Text size="sm" c="dimmed">
            Bu dosya türü ({fileName || 'bilinmeyen'}) henüz desteklenmiyor.
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            Desteklenen: PDF, DOCX, DOC, XLSX, JPG, PNG
          </Text>
        </Box>
      );
  }
}
