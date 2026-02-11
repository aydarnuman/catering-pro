import { ActionIcon, Badge, Box, Divider, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { AGENTS, ATTACHMENT_TYPE_MAP } from '../constants';
import type { OrbitAttachment } from '../types';

interface CompareOverlayProps {
  nodeA: OrbitAttachment;
  nodeB: OrbitAttachment;
  onClose: () => void;
}

function NodePanel({ node }: { node: OrbitAttachment }) {
  const config = ATTACHMENT_TYPE_MAP[node.type];
  const agent = node.sourceAgent ? AGENTS.find((a) => a.id === node.sourceAgent) : null;
  const createdAt = node.createdAt
    ? new Date(node.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
      <Group gap="xs" wrap="nowrap">
        <Badge size="xs" color={config?.color || 'gray'} variant="light">
          {config?.label || node.type}
        </Badge>
        <Text size="sm" fw={700} c="white" lineClamp={1} style={{ flex: 1 }}>
          {node.title}
        </Text>
      </Group>

      <ScrollArea
        h={300}
        styles={{
          viewport: { padding: 8 },
          root: {
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          },
        }}
      >
        <Text
          size="xs"
          c="gray.3"
          style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
        >
          {node.content || 'Icerik yok'}
        </Text>
      </ScrollArea>

      <Group gap="xs">
        {agent && (
          <Badge size="xs" variant="dot" color={agent.color}>
            {agent.name.split(' ')[0]}
          </Badge>
        )}
        {createdAt && (
          <Text size="10px" c="dimmed">{createdAt}</Text>
        )}
        {node.virtual && (
          <Badge size="xs" variant="light" color="gray">Sanal</Badge>
        )}
      </Group>
    </Stack>
  );
}

export function CompareOverlay({ nodeA, nodeB, onClose }: CompareOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        p="lg"
        style={{
          width: '90%',
          maxWidth: 800,
          maxHeight: '80vh',
          background: 'rgba(15,15,30,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Stack gap="md">
          {/* Header */}
          <Group justify="space-between" align="center">
            <Text size="sm" fw={700} c="white">
              Karsilastirma
            </Text>
            <ActionIcon variant="subtle" color="gray" onClick={onClose}>
              <IconX size={16} />
            </ActionIcon>
          </Group>

          <Divider color="dark.5" />

          {/* Side-by-side panels */}
          <Group align="flex-start" gap="md" wrap="nowrap" style={{ minHeight: 0 }}>
            <NodePanel node={nodeA} />
            <Divider orientation="vertical" color="dark.5" />
            <NodePanel node={nodeB} />
          </Group>
        </Stack>
      </Box>
    </motion.div>
  );
}
