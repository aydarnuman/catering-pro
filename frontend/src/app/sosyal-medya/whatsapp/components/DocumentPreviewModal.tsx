import DocViewer, { DocViewerRenderers } from '@cyntler/react-doc-viewer';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconDownload,
  IconFile,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconPhoto,
} from '@tabler/icons-react';
import mammoth from 'mammoth';
import { useCallback, useEffect, useState } from 'react';
import { DocxHtmlBody } from './DocxHtmlBody';

interface DocumentPreviewModalProps {
  previewUrl: string | null;
  previewFilename: string;
  onClose: () => void;
}

export function DocumentPreviewModal({
  previewUrl,
  previewFilename,
  onClose,
}: DocumentPreviewModalProps) {
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Base64 data URL'i Blob URL'e çevir (DocViewer için gerekli)
  const convertToBlob = useCallback(async (dataUrl: string, _filename: string) => {
    try {
      // Base64 data URL'i parse et
      const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (!matches) {
        console.log('Not a base64 data URL, using directly');
        return dataUrl;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      // Base64'ü binary'e çevir
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Blob oluştur
      const blob = new Blob([byteArray], { type: mimeType });

      // Blob URL oluştur
      const blobUrl = URL.createObjectURL(blob);
      console.log('Created blob URL:', blobUrl);
      return blobUrl;
    } catch (error) {
      console.error('Blob conversion error:', error);
      return dataUrl;
    }
  }, []);

  // Preview açıldığında blob URL oluştur ve DOCX için HTML'e çevir
  useEffect(() => {
    const processPreview = async () => {
      if (!previewUrl) return;

      setPreviewLoading(true);
      setDocxHtml(null);

      try {
        // DOCX dosyası için Mammoth.js ile HTML'e çevir
        if (previewFilename.match(/\.docx?$/i)) {
          console.log('Processing DOCX with Mammoth.js...');

          // Base64'ü ArrayBuffer'a çevir
          const matches = previewUrl.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const base64Data = matches[2];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // Mammoth.js ile HTML'e çevir
            const result = await mammoth.convertToHtml({ arrayBuffer });
            console.log('Mammoth conversion successful');
            setDocxHtml(result.value);
          }
        } else {
          // Diğer dosyalar için blob URL oluştur
          if (!previewUrl.startsWith('blob:')) {
            const blobUrl = await convertToBlob(previewUrl, previewFilename);
            setPreviewBlobUrl(blobUrl);
          } else {
            setPreviewBlobUrl(previewUrl);
          }
        }
      } catch (error) {
        console.error('Preview processing error:', error);
      } finally {
        setPreviewLoading(false);
      }
    };

    processPreview();

    // Cleanup - modal kapandığında blob URL'i temizle
    return () => {
      if (previewBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewUrl, previewFilename, convertToBlob, previewBlobUrl]);

  const handleClose = () => {
    // Blob URL'i temizle
    if (previewBlobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setDocxHtml(null);
    setPreviewLoading(false);
    onClose();
  };

  return (
    <Modal
      opened={!!previewUrl}
      onClose={handleClose}
      size="xl"
      fullScreen
      withCloseButton
      title={
        <Group gap="sm">
          {previewFilename.match(/\.pdf$/i) ? (
            <IconFileTypePdf size={20} color="#e74c3c" />
          ) : previewFilename.match(/\.docx?$/i) ? (
            <IconFileTypeDoc size={20} color="#3498db" />
          ) : previewFilename.match(/\.xlsx?$/i) ? (
            <IconFileTypeXls size={20} color="#27ae60" />
          ) : previewFilename.match(/\.(jpe?g|png|gif|webp)$/i) ? (
            <IconPhoto size={20} color="#9b59b6" />
          ) : (
            <IconFile size={20} />
          )}
          <Text>{previewFilename}</Text>
          <Badge size="sm" variant="light" color="gray">
            {previewFilename.split('.').pop()?.toUpperCase()}
          </Badge>
        </Group>
      }
      styles={{
        content: {
          background: '#1a1a2e',
        },
        header: {
          background: '#1a1a2e',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
        title: {
          color: 'white',
        },
        body: {
          height: 'calc(100vh - 60px)',
          padding: 0,
        },
      }}
    >
      <Box style={{ height: '100%', width: '100%', position: 'relative' }}>
        {/* Yükleniyor */}
        {previewLoading && (
          <Box
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Stack align="center" gap="md">
              <Loader size="xl" color="green" />
              <Text c="gray.4">Dosya işleniyor...</Text>
            </Stack>
          </Box>
        )}

        {/* DOCX için Mammoth.js HTML çıktısı */}
        {!previewLoading && docxHtml && (
          <>
            <ScrollArea style={{ height: '100%', padding: 20 }}>
              <Paper
                p="xl"
                radius="md"
                style={{
                  background: 'white',
                  maxWidth: 900,
                  margin: '0 auto',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                <DocxHtmlBody html={docxHtml} />
              </Paper>
            </ScrollArea>

            {/* İndirme butonu */}
            <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
              <Tooltip label="Dosyayı İndir">
                <ActionIcon
                  size="xl"
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'blue', to: 'cyan' }}
                  onClick={() => {
                    if (previewUrl) {
                      const link = document.createElement('a');
                      link.href = previewUrl;
                      link.download = previewFilename || 'document.docx';
                      link.click();
                    }
                  }}
                >
                  <IconDownload size={24} />
                </ActionIcon>
              </Tooltip>
            </Box>
          </>
        )}

        {/* Resim dosyaları */}
        {!previewLoading &&
          !docxHtml &&
          previewBlobUrl &&
          (previewFilename.match(/\.(jpe?g|png|gif|webp|bmp)$/i) ||
            previewUrl?.startsWith('data:image/')) && (
            <>
              <Box
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  background: '#0d0d1a',
                }}
              >
                <Image
                  src={previewBlobUrl}
                  alt={previewFilename}
                  style={{
                    maxWidth: '95%',
                    maxHeight: '95%',
                    objectFit: 'contain',
                    borderRadius: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                />
              </Box>
              <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                <Tooltip label="Dosyayı İndir">
                  <ActionIcon
                    size="xl"
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'green' }}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewBlobUrl;
                      link.download = previewFilename || 'image';
                      link.click();
                    }}
                  >
                    <IconDownload size={24} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            </>
          )}

        {/* PDF için native iframe (daha güvenilir) */}
        {!previewLoading && !docxHtml && previewBlobUrl && previewFilename.match(/\.pdf$/i) && (
          <>
            <iframe
              src={previewBlobUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'white',
              }}
              title={previewFilename}
            />
            <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
              <Tooltip label="Dosyayı İndir">
                <ActionIcon
                  size="xl"
                  radius="xl"
                  variant="gradient"
                  gradient={{ from: 'red', to: 'orange' }}
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewBlobUrl;
                    link.download = previewFilename || 'document.pdf';
                    link.click();
                  }}
                >
                  <IconDownload size={24} />
                </ActionIcon>
              </Tooltip>
            </Box>
          </>
        )}

        {/* Diğer dosyalar için DocViewer (Excel vb.) */}
        {!previewLoading &&
          !docxHtml &&
          previewBlobUrl &&
          !previewFilename.match(/\.(jpe?g|png|gif|webp|bmp|pdf)$/i) &&
          !previewUrl?.startsWith('data:image/') && (
            <>
              <DocViewer
                documents={[
                  {
                    uri: previewBlobUrl,
                    fileName: previewFilename,
                  },
                ]}
                pluginRenderers={DocViewerRenderers}
                config={{
                  header: {
                    disableHeader: true,
                    disableFileName: true,
                  },
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#1a1a2e',
                }}
                theme={{
                  primary: '#25D366',
                  secondary: '#1a1a2e',
                  tertiary: '#2d2d44',
                  textPrimary: '#ffffff',
                  textSecondary: '#a0a0a0',
                  textTertiary: '#666666',
                  disableThemeScrollbar: false,
                }}
              />
              <Box style={{ position: 'absolute', bottom: 20, right: 20, zIndex: 1000 }}>
                <Tooltip label="Dosyayı İndir">
                  <ActionIcon
                    size="xl"
                    radius="xl"
                    variant="gradient"
                    gradient={{ from: 'teal', to: 'green' }}
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewBlobUrl;
                      link.download = previewFilename || 'document';
                      link.click();
                    }}
                  >
                    <IconDownload size={24} />
                  </ActionIcon>
                </Tooltip>
              </Box>
            </>
          )}
      </Box>
    </Modal>
  );
}
