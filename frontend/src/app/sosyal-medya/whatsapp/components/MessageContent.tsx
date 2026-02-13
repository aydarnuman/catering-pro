import { ActionIcon, Badge, Box, Group, Image, Loader, Paper, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconDeviceFloppy,
  IconDownload,
  IconEye,
  IconFile,
  IconFileTypeDoc,
  IconFileTypePdf,
  IconFileTypeXls,
  IconMicrophone,
  IconPhoto,
  IconPlayerPlay,
  IconVideo,
} from '@tabler/icons-react';
import type { Message } from '../types';
import { formatFileSize } from '../utils';

interface MessageContentProps {
  msg: Message;
  messages: Message[];
  downloadingMedia: Set<string>;
  savingMedia: Set<string>;
  onDownloadMedia: (messageId: string) => Promise<boolean | undefined>;
  onSaveMedia: (messageId: string) => void;
  onOpenMediaViewer: (msg: Message) => void;
  onSetPreviewUrl: (url: string | null) => void;
  onSetPreviewFilename: (filename: string) => void;
}

export function MessageContent({
  msg,
  messages,
  downloadingMedia,
  savingMedia,
  onDownloadMedia,
  onSaveMedia,
  onOpenMediaViewer,
  onSetPreviewUrl,
  onSetPreviewFilename,
}: MessageContentProps) {
  const isDownloading = downloadingMedia.has(msg.id);

  // Image mesajı
  if (msg.type === 'image' || (msg.hasMedia && msg.mimetype?.startsWith('image/'))) {
    // Tek tıkla indir ve aç
    const handleImageClick = async () => {
      if (isDownloading) return;

      if (msg.mediaUrl) {
        onOpenMediaViewer(msg);
        return;
      }

      // Medya yoksa indir ve aç
      const success = await onDownloadMedia(msg.id);
      if (success) {
        setTimeout(() => {
          const updatedMsg = messages.find((m) => m.id === msg.id);
          if (updatedMsg?.mediaUrl) {
            onOpenMediaViewer(updatedMsg);
          }
        }, 100);
      }
    };

    return (
      <Box>
        {msg.mediaUrl ? (
          <Box
            style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden' }}
            onClick={() => onOpenMediaViewer(msg)}
          >
            <Image
              src={msg.mediaUrl ?? ''}
              alt=""
              style={{
                maxWidth: 'min(280px, 85vw)',
                maxHeight: 300,
                borderRadius: 8,
                display: 'block',
              }}
            />
          </Box>
        ) : (
          <Box
            p="xl"
            style={{
              background: 'linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(0,0,0,0.2) 100%)',
              borderRadius: 12,
              cursor: 'pointer',
              minWidth: 200,
              border: '1px solid rgba(37,211,102,0.2)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
            onClick={handleImageClick}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,211,102,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Stack align="center" gap="xs">
              {isDownloading ? (
                <Loader size="md" color="green" />
              ) : (
                <ThemeIcon size={60} radius="xl" variant="light" color="green">
                  <IconPhoto size={32} />
                </ThemeIcon>
              )}
              <Text size="sm" c="white" fw={500}>
                {isDownloading ? 'Yükleniyor...' : '🖼️ Fotoğraf'}
              </Text>
              <Text size="xs" c="gray.5">
                Görüntülemek için tıkla
              </Text>
            </Stack>
          </Box>
        )}
        {msg.caption && (
          <Text size="sm" mt={6} style={{ wordBreak: 'break-word' }}>
            {msg.caption}
          </Text>
        )}
      </Box>
    );
  }

  // Video mesajı
  if (msg.type === 'video' || (msg.hasMedia && msg.mimetype?.startsWith('video/'))) {
    return (
      <Box>
        {msg.mediaUrl ? (
          <Box style={{ borderRadius: 8, overflow: 'hidden' }}>
            <video
              src={msg.mediaUrl}
              controls
              style={{
                maxWidth: 'min(280px, 85vw)',
                maxHeight: 300,
                borderRadius: 8,
                display: 'block',
              }}
            >
              <track kind="captions" />
            </video>
          </Box>
        ) : (
          <Box
            p="xl"
            style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              minWidth: 200,
            }}
            onClick={() => onDownloadMedia(msg.id)}
          >
            <Stack align="center" gap="xs">
              {isDownloading ? (
                <Loader size="sm" color="white" />
              ) : (
                <Box style={{ position: 'relative' }}>
                  <IconVideo size={48} style={{ opacity: 0.5 }} />
                  <IconPlayerPlay
                    size={20}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                </Box>
              )}
              <Text size="xs" c="gray.5">
                {isDownloading ? 'İndiriliyor...' : 'Videoyu izlemek için tıkla'}
              </Text>
            </Stack>
          </Box>
        )}
        {msg.caption && (
          <Text size="sm" mt={6} style={{ wordBreak: 'break-word' }}>
            {msg.caption}
          </Text>
        )}
      </Box>
    );
  }

  // Ses mesajı (ptt = push to talk)
  if (msg.type === 'audio' || msg.type === 'ptt' || (msg.hasMedia && msg.mimetype?.startsWith('audio/'))) {
    return (
      <Box>
        {msg.mediaUrl ? (
          <audio src={msg.mediaUrl} controls style={{ maxWidth: 'min(250px, 85vw)' }}>
            <track kind="captions" />
          </audio>
        ) : (
          <Box
            p="md"
            style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 8,
              cursor: 'pointer',
              minWidth: 180,
            }}
            onClick={() => onDownloadMedia(msg.id)}
          >
            <Group gap="sm">
              {isDownloading ? (
                <Loader size="sm" color="white" />
              ) : (
                <IconMicrophone size={24} style={{ opacity: 0.5 }} />
              )}
              <Text size="xs" c="gray.5">
                {isDownloading ? 'İndiriliyor...' : '🎤 Sesli mesaj'}
              </Text>
            </Group>
          </Box>
        )}
      </Box>
    );
  }

  // Döküman mesajı
  if (
    msg.type === 'document' ||
    (msg.hasMedia &&
      !msg.mimetype?.startsWith('image/') &&
      !msg.mimetype?.startsWith('video/') &&
      !msg.mimetype?.startsWith('audio/'))
  ) {
    const isSaving = savingMedia.has(msg.id);
    const isPdf = msg.mimetype?.includes('pdf') || msg.filename?.toLowerCase().endsWith('.pdf');
    const isImage = msg.mimetype?.startsWith('image/');
    const canPreview = isPdf || isImage;
    const isExcel = msg.filename?.match(/\.(xlsx?|csv)$/i);
    const isWord = msg.filename?.match(/\.(docx?|rtf)$/i);

    // Dosya türüne göre renk ve ikon
    const getDocStyle = () => {
      if (isPdf)
        return {
          color: '#e74c3c',
          bg: 'rgba(231, 76, 60, 0.1)',
          icon: <IconFileTypePdf size={32} color="#e74c3c" />,
        };
      if (isExcel)
        return {
          color: '#27ae60',
          bg: 'rgba(39, 174, 96, 0.1)',
          icon: <IconFileTypeXls size={32} color="#27ae60" />,
        };
      if (isWord)
        return {
          color: '#3498db',
          bg: 'rgba(52, 152, 219, 0.1)',
          icon: <IconFileTypeDoc size={32} color="#3498db" />,
        };
      return {
        color: '#95a5a6',
        bg: 'rgba(149, 165, 166, 0.1)',
        icon: <IconFile size={32} color="#95a5a6" />,
      };
    };
    const docStyle = getDocStyle();

    // Tek tıkla aç fonksiyonu
    const handleDocumentClick = async () => {
      if (isDownloading) return;

      // Medya zaten yüklüyse
      if (msg.mediaUrl) {
        if (canPreview) {
          // PDF/resim önizlenebilir
          onSetPreviewUrl(msg.mediaUrl);
          onSetPreviewFilename(msg.filename || 'Döküman');
        } else {
          // Word/Excel için dosya bilgi modalı aç (önizleme URL'si dosya adı ile)
          onSetPreviewUrl(msg.mediaUrl);
          onSetPreviewFilename(msg.filename || 'Döküman');
        }
        return;
      }

      // Medya yoksa önce indir, sonra aç/göster
      const success = await onDownloadMedia(msg.id);
      if (success) {
        setTimeout(() => {
          const updatedMsg = messages.find((m) => m.id === msg.id);
          if (updatedMsg?.mediaUrl) {
            onSetPreviewUrl(updatedMsg.mediaUrl);
            onSetPreviewFilename(updatedMsg.filename || 'Döküman');
          }
        }, 100);
      }
    };

    return (
      <Paper
        p="md"
        radius="lg"
        style={{
          background: `linear-gradient(135deg, ${docStyle.bg} 0%, rgba(0,0,0,0.2) 100%)`,
          border: `1px solid ${docStyle.color}30`,
          minWidth: 280,
          maxWidth: 320,
          cursor: 'pointer',
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
        onClick={handleDocumentClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = `0 4px 20px ${docStyle.color}40`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Üst kısım - İkon ve dosya bilgisi */}
        <Group gap="md" wrap="nowrap" mb="sm">
          <ThemeIcon
            size={50}
            radius="md"
            variant="light"
            style={{ background: docStyle.bg, border: `1px solid ${docStyle.color}40` }}
          >
            {isDownloading ? <Loader size="sm" color={docStyle.color} /> : docStyle.icon}
          </ThemeIcon>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={600} truncate style={{ color: 'white' }}>
              {msg.filename || 'Dosya'}
            </Text>
            <Group gap={6}>
              {msg.filesize && (
                <Badge size="xs" variant="light" color="gray">
                  {formatFileSize(msg.filesize)}
                </Badge>
              )}
              {isPdf && (
                <Badge size="xs" color="red" variant="light">
                  PDF
                </Badge>
              )}
              {isExcel && (
                <Badge size="xs" color="green" variant="light">
                  Excel
                </Badge>
              )}
              {isWord && (
                <Badge size="xs" color="blue" variant="light">
                  Word
                </Badge>
              )}
            </Group>
          </Box>
        </Group>

        {/* Alt kısım - Aksiyon butonları */}
        <Group gap={6} justify="flex-end">
          {/* İndir butonu */}
          {msg.mediaUrl && (
            <Tooltip label="Bilgisayara İndir" position="top">
              <ActionIcon
                variant="light"
                color="teal"
                size="md"
                radius="md"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = msg.mediaUrl;
                  if (url) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = msg.filename || 'document';
                    link.click();
                  }
                }}
              >
                <IconDownload size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Önizle butonu - sadece PDF/resim için ve medya yüklüyse */}
          {canPreview && msg.mediaUrl && (
            <Tooltip label="Önizle" position="top">
              <ActionIcon
                variant="light"
                color="violet"
                size="md"
                radius="md"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = msg.mediaUrl;
                  if (url) {
                    onSetPreviewUrl(url);
                    onSetPreviewFilename(msg.filename || 'Döküman');
                  }
                }}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Sunucuya Kaydet */}
          <Tooltip label="Sunucuya Kaydet" position="top">
            <ActionIcon
              variant="light"
              color="orange"
              size="md"
              radius="md"
              loading={isSaving}
              onClick={(e) => {
                e.stopPropagation();
                onSaveMedia(msg.id);
              }}
            >
              <IconDeviceFloppy size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {msg.caption && (
          <Text size="sm" mt="sm" style={{ wordBreak: 'break-word', opacity: 0.9 }}>
            {msg.caption}
          </Text>
        )}
      </Paper>
    );
  }

  // Sticker mesajı
  if (msg.type === 'sticker') {
    return (
      <Box>
        {msg.mediaUrl ? (
          <Image src={msg.mediaUrl} alt="Sticker" style={{ width: 128, height: 128, objectFit: 'contain' }} />
        ) : (
          <Box
            p="md"
            style={{
              width: 128,
              height: 128,
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={() => onDownloadMedia(msg.id)}
          >
            {isDownloading ? <Loader size="sm" color="white" /> : <Text size="xl">🎨</Text>}
          </Box>
        )}
      </Box>
    );
  }

  // Text mesajı (default)
  return (
    <span
      style={{
        fontSize: 14,
        color: msg.fromMe ? 'white' : '#e0e0e0',
        wordBreak: 'break-word',
        lineHeight: 1.4,
        whiteSpace: 'pre-wrap',
      }}
    >
      {msg.content || (msg.hasMedia ? '📎 Medya' : '')}
    </span>
  );
}
