import { Badge, Box, Button, Group, Image, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconPhoto, IconSend, IconVideo } from '@tabler/icons-react';

interface PendingFile {
  file: File;
  type: 'image' | 'video' | 'document';
  preview?: string;
}

interface CaptionModalProps {
  opened: boolean;
  pendingFile: PendingFile | null;
  captionText: string;
  sendingMedia: boolean;
  onCaptionChange: (text: string) => void;
  onSend: () => void;
  onCancel: () => void;
}

export function CaptionModal({
  opened,
  pendingFile,
  captionText,
  sendingMedia,
  onCaptionChange,
  onSend,
  onCancel,
}: CaptionModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      size="lg"
      centered
      title={
        <Group gap="sm">
          {pendingFile?.type === 'image' && <IconPhoto size={20} color="#25D366" />}
          {pendingFile?.type === 'video' && <IconVideo size={20} color="#3B82F6" />}
          <Text fw={600}>{pendingFile?.type === 'image' ? 'Fotoğraf Gönder' : 'Video Gönder'}</Text>
        </Group>
      }
      styles={{
        content: {
          background: 'linear-gradient(145deg, #1a1f2e 0%, #0f1419 100%)',
        },
        header: {
          background: 'transparent',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
        title: {
          color: 'white',
        },
      }}
    >
      <Stack gap="md">
        {/* Preview */}
        {pendingFile?.preview && (
          <Box
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.3)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              maxHeight: 400,
            }}
          >
            {pendingFile.type === 'image' ? (
              <Image
                src={pendingFile.preview}
                alt="Önizleme"
                style={{
                  maxWidth: '100%',
                  maxHeight: 400,
                  objectFit: 'contain',
                }}
              />
            ) : (
              <video
                src={pendingFile.preview}
                controls
                style={{
                  maxWidth: '100%',
                  maxHeight: 400,
                }}
              >
                <track kind="captions" />
              </video>
            )}
          </Box>
        )}

        {/* File info */}
        <Group gap="xs">
          <Badge size="sm" variant="light" color="gray">
            {pendingFile?.file.name}
          </Badge>
          <Badge size="sm" variant="light" color="blue">
            {pendingFile?.file.size ? `${(pendingFile.file.size / 1024 / 1024).toFixed(2)} MB` : ''}
          </Badge>
        </Group>

        {/* Caption input */}
        <Textarea
          placeholder="Açıklama ekleyin (isteğe bağlı)..."
          value={captionText}
          onChange={(e) => onCaptionChange(e.target.value)}
          minRows={2}
          maxRows={4}
          radius="md"
          styles={{
            input: {
              background: 'var(--surface-elevated)',
              border: '1px solid var(--surface-border)',
              color: 'white',
            },
          }}
        />

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onCancel}>
            İptal
          </Button>
          <Button
            variant="gradient"
            gradient={{ from: '#25D366', to: '#128C7E' }}
            leftSection={<IconSend size={18} />}
            onClick={onSend}
            loading={sendingMedia}
          >
            Gönder
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
