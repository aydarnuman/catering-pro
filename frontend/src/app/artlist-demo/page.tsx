'use client';

import { Box } from '@mantine/core';
import { ArtlistHeader, GenerationToolbar } from '@/components/artlist';

export default function ArtlistDemo() {
  return (
    <Box style={{ minHeight: '100vh', background: 'var(--artlist-background, #121212)' }}>
      <ArtlistHeader />
      <Box style={{ height: 'calc(100vh - 200px)' }} />
      {/* Catering Pro: hızlı aksiyonlar, AI, ihale/finans/stok kısayolları */}
      <GenerationToolbar variant="catering" />
    </Box>
  );
}
