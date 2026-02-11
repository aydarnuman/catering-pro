import { Box } from '@mantine/core';
import type { ViewMode } from '../types';

interface StageBackgroundProps {
  viewMode: ViewMode;
}

export function StageBackground({ viewMode }: StageBackgroundProps) {
  return (
    <Box
      className={`sanal-masa-stage${viewMode === 'ASSEMBLE' ? ' assembled' : ''}`}
    />
  );
}
