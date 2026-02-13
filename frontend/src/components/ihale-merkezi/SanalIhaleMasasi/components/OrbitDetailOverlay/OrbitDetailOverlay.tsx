import { AnimatePresence, motion } from 'framer-motion';
import { SPRING_CONFIG } from '../../constants';
import type { AttachmentType, OrbitAttachment } from '../../types';
import { CreateMode } from './CreateMode';
import { EditMode } from './EditMode';
import { ViewMode } from './ViewMode';

interface OrbitDetailOverlayProps {
  attachment: OrbitAttachment | null;
  mode: 'view' | 'edit' | 'create';
  createType?: AttachmentType;
  onSave: (id: string, updates: { title?: string; content?: string }) => Promise<void>;
  onCreate: (input: { title: string; type: AttachmentType; content: string; url?: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<void>;
  onSaveVirtual?: (id: string) => Promise<void>;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export function OrbitDetailOverlay({
  attachment,
  mode,
  createType,
  onSave,
  onCreate,
  onDelete,
  onSaveVirtual,
  onClose,
  onEdit,
}: OrbitDetailOverlayProps) {
  const isOpen = mode === 'create' || !!attachment;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="orbit-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="orbit-detail-overlay"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ ...SPRING_CONFIG.stiff, duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {mode === 'create' && <CreateMode initialType={createType} onSave={onCreate} onClose={onClose} />}
            {mode === 'edit' && attachment && <EditMode attachment={attachment} onSave={onSave} onCancel={onClose} />}
            {mode === 'view' && attachment && (
              <ViewMode
                attachment={attachment}
                onEdit={() => onEdit(attachment.id)}
                onDelete={() => onDelete(attachment.id)}
                onSaveVirtual={onSaveVirtual ? () => onSaveVirtual(attachment.id) : undefined}
                onClose={onClose}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
