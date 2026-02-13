import { Box, Group, Stack, Text } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { AGENTS } from '../../constants';
import type { AgentPersona } from '../../types';

export function ContextMenuPopup({
  x,
  y,
  onSendTo,
  onBroadcast,
}: {
  x: number;
  y: number;
  onSendTo: (agentId: AgentPersona['id']) => void;
  onBroadcast?: () => void;
}) {
  return (
    <Box
      style={{
        position: 'absolute',
        top: y,
        left: x,
        zIndex: 60,
        background: 'rgba(20,20,35,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 4,
        backdropFilter: 'blur(12px)',
        minWidth: 200,
      }}
    >
      <Stack gap={2}>
        <Text size="9px" c="dimmed" px={8} pt={4} pb={2} fw={600}>
          Ajana Gonder
        </Text>
        {AGENTS.map((agent) => (
          <Box
            key={agent.id}
            px={8}
            py={5}
            style={{
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={() => onSendTo(agent.id)}
          >
            <Group gap={6}>
              <Box
                w={8}
                h={8}
                style={{
                  borderRadius: '50%',
                  background: `var(--mantine-color-${agent.color}-5)`,
                  flexShrink: 0,
                }}
              />
              <Text size="xs" c="white" fw={500}>
                {agent.name}
              </Text>
            </Group>
          </Box>
        ))}
        {onBroadcast && (
          <>
            <Box style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '2px 8px' }} />
            <Box
              px={8}
              py={5}
              style={{
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              onClick={onBroadcast}
            >
              <Group gap={6}>
                <IconSend size={12} color="rgba(255,255,255,0.6)" />
                <Text size="xs" c="white" fw={500}>
                  Tum Ajanlara Gonder
                </Text>
              </Group>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
