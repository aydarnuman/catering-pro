'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCards,
  IconFile,
  IconFileSearch,
  IconFileText,
  IconPhoto,
  IconPlus,
  IconTable,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { type CardCategory, type CardType, useTenderCards } from '@/hooks/useTenderCards';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import type { SavedTender } from '../../types';
import { type DocFileType, detectFileType, UniversalDocViewer } from './UniversalDocViewer';

// ─── Types ─────────────────────────────────────────────────────

interface DocumentInfo {
  id: number;
  original_filename: string;
  file_type: string;
  doc_type: string;
  source_type: 'content' | 'download' | 'upload';
  processing_status: string;
  storage_url?: string;
  content_text?: string;
  extracted_text?: string;
}

interface DokumanDogrulamaPanelProps {
  savedTender: SavedTender | null;
  onOpenDocumentWizard: () => void;
}

// ─── File type icon helper ─────────────────────────────────────

function getFileTypeIcon(fileType: DocFileType) {
  switch (fileType) {
    case 'pdf':
      return <IconFileText size={14} />;
    case 'docx':
      return <IconFileText size={14} />;
    case 'xlsx':
      return <IconTable size={14} />;
    case 'image':
      return <IconPhoto size={14} />;
    case 'html':
      return <IconFileSearch size={14} />;
    default:
      return <IconFile size={14} />;
  }
}

function getFileTypeColor(fileType: DocFileType) {
  switch (fileType) {
    case 'pdf':
      return 'red';
    case 'docx':
      return 'blue';
    case 'xlsx':
      return 'green';
    case 'image':
      return 'orange';
    case 'html':
      return 'cyan';
    default:
      return 'gray';
  }
}

/**
 * Doküman Doğrulama Paneli
 * Döküman listesi + seçilen dökümanı UniversalDocViewer ile gösterir
 */
export function DokumanDogrulamaPanel({ savedTender, onOpenDocumentWizard }: DokumanDogrulamaPanelProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [viewerOpened, { open: openViewer, close: closeViewer }] = useDisclosure(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  // Card creation from text selection
  const [cardModalOpened, { open: openCardModal, close: closeCardModal }] = useDisclosure(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardCategory, setNewCardCategory] = useState<CardCategory>('diger');
  const [newCardType, setNewCardType] = useState<CardType>('text');

  const tenderId = savedTender?.tender_id;
  const hasDocs = (savedTender?.dokuman_sayisi || 0) > 0;

  // Custom cards hook
  const { createCard, isCreating } = useTenderCards(tenderId || null);

  // Döküman listesini yükle
  useEffect(() => {
    if (!tenderId || !hasDocs) return;

    let cancelled = false;
    async function fetchDocs() {
      setLoading(true);
      try {
        const res = await api.get(getApiUrl(`/api/tenders/${tenderId}/downloaded-documents`));
        const grouped = res.data?.data?.documents || [];
        // Flat list
        const flat: DocumentInfo[] = [];
        for (const group of grouped) {
          for (const file of group.files || []) {
            flat.push(file);
          }
        }
        if (!cancelled) setDocuments(flat);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDocs();
    return () => {
      cancelled = true;
    };
  }, [tenderId, hasDocs]);

  // Döküman seçildiğinde signed URL al
  const selectDocument = useCallback(
    async (doc: DocumentInfo) => {
      setSelectedDoc(doc);
      setSignedUrl(null);
      setSelectedText(null);

      // HTML/content türleri URL gerektirmez
      if (doc.source_type === 'content') {
        openViewer();
        return;
      }

      if (!doc.storage_url) {
        openViewer();
        return;
      }

      setUrlLoading(true);
      try {
        const res = await api.get(getApiUrl(`/api/tender-docs/documents/${doc.id}/url`));
        setSignedUrl(res.data?.data?.signedUrl || null);
      } catch {
        setSignedUrl(null);
      } finally {
        setUrlLoading(false);
        openViewer();
      }
    },
    [openViewer]
  );

  const handleTextSelect = useCallback((text: string, _pageNumber?: number) => {
    setSelectedText(text);
  }, []);

  const handleCreateCardFromSelection = useCallback(() => {
    if (!selectedText) return;
    setNewCardTitle('');
    setNewCardCategory('diger');
    setNewCardType('text');
    openCardModal();
  }, [selectedText, openCardModal]);

  const handleSaveCard = useCallback(async () => {
    if (!tenderId || !newCardTitle.trim()) return;
    try {
      await createCard({
        title: newCardTitle.trim(),
        card_type: newCardType,
        content: { text: selectedText || '' },
        source_type: 'pdf_selection',
        source_document_id: selectedDoc?.id,
        source_text: selectedText || undefined,
        category: newCardCategory,
      });
      closeCardModal();
      setSelectedText(null);
    } catch {
      // error handled in hook
    }
  }, [tenderId, newCardTitle, newCardType, selectedText, selectedDoc, newCardCategory, createCard, closeCardModal]);

  // ─── No documents state ───────────────────────────────────
  if (!hasDocs) {
    return (
      <Stack align="center" gap="md" py="xl">
        <ThemeIcon size={64} radius="xl" variant="light" color="blue">
          <IconUpload size={32} />
        </ThemeIcon>
        <Box ta="center">
          <Text size="md" fw={600}>
            Henüz Döküman Yok
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Doğrulama yapabilmek için önce dökümanları indirin ve analiz edin.
          </Text>
        </Box>
        <Button variant="filled" color="blue" leftSection={<IconUpload size={16} />} onClick={onOpenDocumentWizard}>
          Döküman Yönetimi
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Dökümanlar ({documents.length})
        </Text>
        <Button variant="light" size="xs" leftSection={<IconUpload size={14} />} onClick={onOpenDocumentWizard}>
          Döküman Yönetimi
        </Button>
      </Group>

      {/* Loading state */}
      {loading && (
        <Box ta="center" py="lg">
          <Loader size="sm" />
          <Text size="xs" c="dimmed" mt="xs">
            Dökümanlar yükleniyor...
          </Text>
        </Box>
      )}

      {/* Document list */}
      {!loading && documents.length === 0 && (
        <Paper p="md" withBorder radius="md" ta="center">
          <Text size="sm" c="dimmed">
            İndirilen döküman bulunamadı.
          </Text>
        </Paper>
      )}

      {!loading &&
        documents.map((doc) => {
          const fileType = detectFileType(doc.original_filename, doc.file_type, doc.source_type);
          const isSelected = selectedDoc?.id === doc.id;

          return (
            <Paper
              key={doc.id}
              p="sm"
              withBorder
              radius="md"
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.02))'
                  : undefined,
                transition: 'all 0.15s ease',
              }}
              onClick={() => selectDocument(doc)}
            >
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon size="md" variant="light" color={getFileTypeColor(fileType)} radius="md">
                  {getFileTypeIcon(fileType)}
                </ThemeIcon>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate="end">
                    {doc.original_filename || 'Adsız döküman'}
                  </Text>
                  <Group gap={4} mt={2}>
                    <Badge size="xs" variant="dot" color={getFileTypeColor(fileType)}>
                      {fileType.toUpperCase()}
                    </Badge>
                    {doc.doc_type && (
                      <Badge size="xs" variant="light" color="gray">
                        {doc.doc_type}
                      </Badge>
                    )}
                    <Badge
                      size="xs"
                      variant="light"
                      color={
                        doc.processing_status === 'completed'
                          ? 'green'
                          : doc.processing_status === 'failed'
                            ? 'red'
                            : 'yellow'
                      }
                    >
                      {doc.processing_status === 'completed'
                        ? 'Analiz Edildi'
                        : doc.processing_status === 'failed'
                          ? 'Hata'
                          : 'Beklemede'}
                    </Badge>
                  </Group>
                </Box>
                <Tooltip label="Dökümanı Görüntüle">
                  <ActionIcon variant="light" color="blue" size="sm">
                    <IconFileSearch size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          );
        })}

      {/* ─── Document Viewer Drawer ─────────────────────────────── */}
      <Drawer
        opened={viewerOpened}
        onClose={closeViewer}
        title={
          <Group gap="xs">
            <ThemeIcon size="sm" variant="light" color="blue">
              <IconFileSearch size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600} truncate="end" maw={400}>
              {selectedDoc?.original_filename || 'Döküman'}
            </Text>
          </Group>
        }
        position="right"
        size="80%"
        padding={0}
        styles={{
          body: { height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' },
        }}
      >
        {/* Selection bar - metin seçildiğinde göster */}
        {selectedText && (
          <Paper
            p="xs"
            m="xs"
            withBorder
            radius="md"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.02))',
              borderColor: 'var(--mantine-color-blue-4)',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between" gap="xs">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" c="dimmed" mb={2}>
                  Seçilen metin:
                </Text>
                <Text size="xs" lineClamp={2} style={{ fontFamily: 'monospace' }}>
                  {selectedText}
                </Text>
              </Box>
              <Group gap={4}>
                <Tooltip label="Seçimden kart oluştur">
                  <Button
                    size="compact-xs"
                    variant="light"
                    leftSection={<IconCards size={14} />}
                    onClick={handleCreateCardFromSelection}
                  >
                    Kart Oluştur
                  </Button>
                </Tooltip>
                <ActionIcon variant="subtle" size="xs" onClick={() => setSelectedText(null)}>
                  <IconX size={12} />
                </ActionIcon>
              </Group>
            </Group>
          </Paper>
        )}

        {/* Viewer content */}
        <Box style={{ flex: 1, minHeight: 0 }}>
          {urlLoading ? (
            <Box ta="center" py="xl">
              <Loader size="sm" />
              <Text size="xs" c="dimmed" mt="xs">
                URL hazırlanıyor...
              </Text>
            </Box>
          ) : selectedDoc?.source_type === 'content' ? (
            <UniversalDocViewer
              url=""
              documentId={selectedDoc.id}
              fileName={selectedDoc.original_filename}
              sourceType="content"
              contentText={selectedDoc.content_text || selectedDoc.extracted_text || ''}
              onTextSelect={handleTextSelect}
            />
          ) : signedUrl ? (
            <UniversalDocViewer
              url={signedUrl}
              documentId={selectedDoc?.id}
              fileName={selectedDoc?.original_filename}
              mimeType={selectedDoc?.file_type}
              sourceType={selectedDoc?.source_type}
              ocrText={selectedDoc?.extracted_text}
              onTextSelect={handleTextSelect}
            />
          ) : selectedDoc?.extracted_text ? (
            <UniversalDocViewer
              url=""
              documentId={selectedDoc?.id}
              fileName={selectedDoc?.original_filename}
              mimeType={selectedDoc?.file_type}
              sourceType={selectedDoc?.source_type}
              ocrText={selectedDoc?.extracted_text}
              onTextSelect={handleTextSelect}
            />
          ) : (
            <Box ta="center" py="xl">
              <Text size="sm" c="dimmed">
                Döküman dosyası bulunamadı veya henüz işlenmedi.
              </Text>
              <Text size="xs" c="dimmed" mt="xs">
                {selectedDoc?.processing_status === 'processing'
                  ? 'Döküman işleniyor, lütfen bekleyin...'
                  : 'Dosya yüklenirken bir sorun oluşmuş olabilir.'}
              </Text>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Card Creation Modal */}
      <Modal opened={cardModalOpened} onClose={closeCardModal} title="Seçimden Kart Oluştur" centered size="md">
        <Stack gap="sm">
          <Paper p="xs" withBorder radius="sm" bg="gray.0">
            <Text size="xs" c="dimmed" mb={2}>
              Seçilen metin:
            </Text>
            <Text size="xs" lineClamp={4} style={{ fontFamily: 'monospace' }}>
              {selectedText}
            </Text>
          </Paper>

          <TextInput
            label="Kart Başlığı"
            placeholder="Örn: Personel Sayısı, Yemek Saatleri..."
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.currentTarget.value)}
            required
          />

          <Select
            label="Kategori"
            data={[
              { value: 'operasyonel', label: 'Operasyonel' },
              { value: 'mali', label: 'Mali' },
              { value: 'teknik', label: 'Teknik' },
              { value: 'belgeler', label: 'Belgeler' },
              { value: 'diger', label: 'Diğer' },
            ]}
            value={newCardCategory}
            onChange={(val) => setNewCardCategory((val as CardCategory) || 'diger')}
          />

          <Select
            label="Kart Tipi"
            data={[
              { value: 'text', label: 'Metin' },
              { value: 'table', label: 'Tablo' },
              { value: 'list', label: 'Liste' },
              { value: 'key_value', label: 'Anahtar-Değer' },
            ]}
            value={newCardType}
            onChange={(val) => setNewCardType((val as CardType) || 'text')}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={closeCardModal}>
              İptal
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleSaveCard}
              loading={isCreating}
              disabled={!newCardTitle.trim()}
            >
              Kart Oluştur
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
