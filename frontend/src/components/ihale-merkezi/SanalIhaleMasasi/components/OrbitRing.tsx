import { Text, Tooltip } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ORBIT_RING_CONFIG, SPRING_CONFIG } from '../constants';
import type { OrbitAttachment, ViewMode } from '../types';
import { OrbitNode } from './OrbitNode';

interface OrbitRingProps {
  attachments: OrbitAttachment[];
  positions: { x: number; y: number; angle: number }[];
  viewMode: ViewMode;
  loading: boolean;
  compareFirstId?: string | null;
  onNodeClick: (id: string, shiftKey: boolean) => void;
  onAddClick: () => void;
}

export function OrbitRing({
  attachments,
  positions,
  viewMode,
  loading,
  compareFirstId,
  onNodeClick,
  onAddClick,
}: OrbitRingProps) {
  const { radiusX, radiusY, maxVisibleNodes } = ORBIT_RING_CONFIG;
  const visibleAttachments = attachments.slice(0, maxVisibleNodes);
  const overflowCount = attachments.length - maxVisibleNodes;

  // ViewMode visibility
  const containerClass = `orbit-ring-container${
    viewMode === 'ASSEMBLE' ? ' hidden' : viewMode === 'FOCUS' ? ' dimmed' : ''
  }`;

  // SVG guide ellipse dimensions (doubled for full ellipse)
  const svgW = radiusX * 2 + 60;
  const svgH = radiusY * 2 + 60;

  return (
    <div className={containerClass} style={{ width: svgW, height: svgH }}>
      {/* Guide ellipse */}
      <svg
        className="orbit-guide-ellipse"
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
      >
        <ellipse
          cx={svgW / 2}
          cy={svgH / 2}
          rx={radiusX}
          ry={radiusY}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
          strokeDasharray="6 4"
        />
      </svg>

      {/* Attachment nodes */}
      <AnimatePresence>
        {visibleAttachments.map((attachment, idx) => (
          <OrbitNode
            key={attachment.id}
            attachment={attachment}
            position={positions[idx] || { x: 0, y: 0 }}
            index={idx}
            isCompareSelected={compareFirstId === attachment.id}
            onClick={(e) => onNodeClick(attachment.id, e.shiftKey)}
          />
        ))}
      </AnimatePresence>

      {/* Overflow node (+N) */}
      {overflowCount > 0 && (
        <Tooltip label={`${overflowCount} ek oge`} position="top" withArrow>
          <motion.div
            className="orbit-overflow-node"
            style={{
              left: `calc(50% + ${positions[maxVisibleNodes]?.x || 0}px - 18px)`,
              top: `calc(50% + ${positions[maxVisibleNodes]?.y || 0}px - 18px)`,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING_CONFIG.gentle}
          >
            <Text size="10px" fw={700} c="dimmed">
              +{overflowCount}
            </Text>
          </motion.div>
        </Tooltip>
      )}

      {/* Add button (last position) */}
      <Tooltip label="Yeni ekle" position="top" withArrow>
        <motion.div
          className="orbit-add-button"
          style={{
            left: `calc(50% + ${positions[positions.length - 1]?.x || 0}px - 18px)`,
            top: `calc(50% + ${positions[positions.length - 1]?.y || 0}px - 18px)`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: loading ? 0.4 : 1, scale: 1 }}
          transition={{ ...SPRING_CONFIG.gentle, delay: positions.length * 0.06 }}
          onClick={(e) => {
            e.stopPropagation();
            onAddClick();
          }}
        >
          <IconPlus size={14} color="rgba(255,255,255,0.4)" />
        </motion.div>
      </Tooltip>
    </div>
  );
}
