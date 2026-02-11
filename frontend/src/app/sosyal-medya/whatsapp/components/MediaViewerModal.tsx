import { Button, Group, Image, Modal, Stack, Text } from '@mantine/core';
import { IconDownload, IconPhoto, IconVideo } from '@tabler/icons-react';
import type { Message } from '../types';

interface MediaViewerModalProps {
  opened: boolean;
  onClose: () => void;
  viewingMedia: Message | null;
}

export function MediaViewerModal({ opened, onClose, viewingMedia }: MediaViewerModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      centered
      withCloseButton
      title={
        <Group gap="sm">
          {viewingMedia?.type === 'image' && <IconPhoto size={20} />}
          {viewingMedia?.type === 'video' && <IconVideo size={20} />}
          <Text>Medya Görüntüleyici</Text>
        </Group>
      }
      styles={{
        content: {
          background: 'rgba(0,0,0,0.95)',
        },
        header: {
          background: 'rgba(0,0,0,0.95)',
        },
        title: {
          color: 'white',
        },
      }}
    >
      <Stack align="center" gap="md">
        {viewingMedia?.mediaUrl && (
          <>
            {viewingMedia.type === 'image' || viewingMedia.mimetype?.startsWith('image/') ? (
              <Image
                src={viewingMedia.mediaUrl}
                alt="Tam boy"
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 8,
                }}
              />
            ) : viewingMedia.type === 'video' || viewingMedia.mimetype?.startsWith('video/') ? (
              <video
                src={viewingMedia.mediaUrl}
                controls
                autoPlay
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
              >
                <track kind="captions" />
              </video>
            ) : null}

            {viewingMedia.caption && (
              <Text c="white" ta="center" style={{ maxWidth: 500 }}>
                {viewingMedia.caption}
              </Text>
            )}

            <Button
              variant="light"
              color="green"
              leftSection={<IconDownload size={18} />}
              onClick={() => {
                if (viewingMedia.mediaUrl) {
                  const link = document.createElement('a');
                  link.href = viewingMedia.mediaUrl;
                  link.download = viewingMedia.filename || `media-${Date.now()}`;
                  link.click();
                }
              }}
            >
              İndir
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
