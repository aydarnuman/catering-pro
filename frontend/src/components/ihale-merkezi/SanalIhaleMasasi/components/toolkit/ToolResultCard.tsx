import { ActionIcon, Box, Group, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ToolResultCardProps {
  title: string;
  color: string;
  onClose: () => void;
  children: ReactNode;
}

export function ToolResultCard({ title, color, onClose, children }: ToolResultCardProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        <Box
          p="sm"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 12,
            border: `1px solid rgba(255,255,255,0.06)`,
            borderLeft: `3px solid var(--mantine-color-${color}-5)`,
          }}
        >
          <Group justify="space-between" mb={8}>
            <Text size="xs" fw={700} c={color}>
              {title}
            </Text>
            <ActionIcon variant="subtle" color="gray" size="xs" onClick={onClose}>
              <IconX size={12} />
            </ActionIcon>
          </Group>
          {children}
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}
