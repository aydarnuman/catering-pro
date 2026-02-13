import { Box, Stack, Text } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface TenderDocumentCardProps {
  title: string;
  kurum: string;
  bedel?: string;
}

export function TenderDocumentCard({ title, kurum, bedel }: TenderDocumentCardProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.03, 1],
        boxShadow: [
          '0 0 20px rgba(255,255,255,0.05)',
          '0 0 40px rgba(255,255,255,0.12)',
          '0 0 20px rgba(255,255,255,0.05)',
        ],
      }}
      transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      style={{ borderRadius: 12 }}
    >
      <Box className="tender-doc-card">
        <Stack align="center" gap={8}>
          <IconFileText size={28} color="rgba(200,200,220,0.7)" />

          <Text size="xs" fw={700} ta="center" c="white" lineClamp={3} style={{ lineHeight: 1.4 }}>
            {title}
          </Text>

          <Text size="10px" ta="center" c="dimmed" lineClamp={1}>
            {kurum}
          </Text>

          {bedel && (
            <Text size="10px" ta="center" c="cyan" fw={600}>
              {bedel}
            </Text>
          )}
        </Stack>
      </Box>
    </motion.div>
  );
}
