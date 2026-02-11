import { Button } from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { motion } from 'framer-motion';

interface AssembleButtonProps {
  onClick: () => void;
}

export function AssembleButton({ onClick }: AssembleButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
      className="assemble-btn"
    >
      <Button
        size="lg"
        variant="gradient"
        gradient={{ from: 'violet', to: 'indigo', deg: 135 }}
        leftSection={<IconUsers size={20} />}
        onClick={onClick}
        radius="md"
        style={{
          boxShadow: '0 4px 24px rgba(139, 92, 246, 0.3)',
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
        styles={{
          root: {
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 32px rgba(139, 92, 246, 0.45)',
            },
          },
        }}
      >
        KARAR VER
      </Button>
    </motion.div>
  );
}
