import { Tooltip } from '@mantine/core';
import {
  IconBrain,
  IconFileCertificate,
  IconFileText,
  IconLink,
  IconMathFunction,
  IconNote,
  IconUser,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { ATTACHMENT_TYPE_MAP, SPRING_CONFIG } from '../constants';
import type { OrbitAttachment } from '../types';

const ICON_MAP: Record<string, typeof IconNote> = {
  note: IconNote,
  'file-text': IconFileText,
  'file-certificate': IconFileCertificate,
  brain: IconBrain,
  link: IconLink,
  user: IconUser,
  'math-function': IconMathFunction,
};

interface OrbitNodeProps {
  attachment: OrbitAttachment;
  position: { x: number; y: number };
  index: number;
  isCompareSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function OrbitNode({ attachment, position, index, isCompareSelected, onClick }: OrbitNodeProps) {
  const config = ATTACHMENT_TYPE_MAP[attachment.type];
  const Icon = ICON_MAP[config?.icon || 'note'] || IconNote;
  const accentColor = `var(--mantine-color-${config?.color || 'yellow'}-5)`;

  const isVirtual = !!attachment.virtual;

  return (
    <Tooltip
      label={isVirtual ? `${attachment.title} — Kaydetmek icin tikla` : attachment.title || config?.label || 'Not'}
      position="top"
      withArrow
    >
      <motion.div
        className={`orbit-node${attachment.pinned ? ' pinned' : ''}${isVirtual ? ' virtual' : ''}`}
        style={{
          '--node-accent': accentColor,
          left: `calc(50% + ${position.x}px - 18px)`,
          top: `calc(50% + ${position.y}px - 18px)`,
          ...(isCompareSelected
            ? { outline: '2px solid #3b82f6', outlineOffset: 2 }
            : {}),
        } as React.CSSProperties}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_CONFIG.gentle, delay: index * 0.06 }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
      >
        <Icon size={16} color={accentColor} />
        {attachment.sourceAgent && (
          <div
            className="agent-dot"
            style={{
              background:
                attachment.sourceAgent === 'mevzuat'
                  ? '#6366f1'
                  : attachment.sourceAgent === 'maliyet'
                    ? '#10b981'
                    : attachment.sourceAgent === 'teknik'
                      ? '#f59e0b'
                      : '#f43f5e',
            }}
          />
        )}
      </motion.div>
    </Tooltip>
  );
}
