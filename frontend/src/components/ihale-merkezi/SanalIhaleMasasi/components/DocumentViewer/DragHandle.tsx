import { Box, Text } from '@mantine/core';
import { IconGripVertical } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export function DragHandle({
  pos,
  text,
  onDragStart,
  onDragEnd,
}: {
  pos: { x: number; y: number };
  text: string;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <motion.div
      drag
      dragSnapToOrigin
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileDrag={{ scale: 1.2, zIndex: 100 }}
      style={{
        position: 'absolute',
        top: pos.y,
        left: pos.x,
        cursor: 'grab',
        zIndex: 50,
      }}
    >
      <Box className="drag-handle-chip">
        <IconGripVertical size={12} />
        <Text size="9px" fw={600} lineClamp={1} style={{ maxWidth: 80 }}>
          {text.slice(0, 30)}...
        </Text>
      </Box>
    </motion.div>
  );
}
