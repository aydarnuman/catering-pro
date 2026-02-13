import { Badge, Box, Button, Group, NativeSelect, Slider, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { agentAPI } from '@/lib/api/services/agents';
import type { AgentPersona } from '../types';

const MODEL_OPTIONS = [{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4' }];

interface AgentSettingsEditorProps {
  agent: AgentPersona;
  agentDetail: Record<string, unknown>;
}

export function AgentSettingsEditor({ agent, agentDetail }: AgentSettingsEditorProps) {
  const queryClient = useQueryClient();
  const initModel = (agentDetail.model as string) || 'claude-opus-4-20250514';
  const initTemp = typeof agentDetail.temperature === 'number' ? agentDetail.temperature : 0.3;
  const initPrompt = (agentDetail.system_prompt as string) || '';
  const verdictWeight = typeof agentDetail.verdict_weight === 'number' ? agentDetail.verdict_weight : 0;

  const [model, setModel] = useState(initModel);
  const [temperature, setTemperature] = useState(initTemp);
  const [systemPrompt, setSystemPrompt] = useState(initPrompt);
  const [saving, setSaving] = useState(false);

  const hasChanges = model !== initModel || temperature !== initTemp || systemPrompt !== initPrompt;

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await agentAPI.update(agent.id, {
        model,
        temperature,
        system_prompt: systemPrompt,
      });
      if (response.success) {
        notifications.show({
          title: 'Kaydedildi',
          message: `${agent.name} ayarları güncellendi`,
          color: 'teal',
          icon: <IconCheck size={16} />,
        });
        queryClient.invalidateQueries({ queryKey: ['agent-detail', agent.id] });
        queryClient.invalidateQueries({ queryKey: ['agent-registry'] });
      } else {
        notifications.show({
          title: 'Hata',
          message: 'Ayarlar kaydedilemedi',
          color: 'red',
        });
      }
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Bağlantı hatası',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Model */}
      <Box p="sm" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <Text size="xs" c="dimmed" mb={6}>
          AI Model
        </Text>
        <NativeSelect
          value={model}
          onChange={(e) => setModel(e.currentTarget.value)}
          data={MODEL_OPTIONS}
          size="xs"
          styles={{
            input: {
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'white',
            },
          }}
        />
      </Box>

      {/* Temperature */}
      <Box p="sm" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <Group justify="space-between" mb={6}>
          <Text size="xs" c="dimmed">
            Yaratıcılık (Temperature)
          </Text>
          <Badge size="xs" variant="light" color={agent.color}>
            {Number(temperature ?? 0).toFixed(2)}
          </Badge>
        </Group>
        <Slider
          value={temperature}
          onChange={setTemperature}
          min={0}
          max={1}
          step={0.05}
          color={agent.color}
          size="sm"
          marks={[
            { value: 0, label: 'Kesin' },
            { value: 0.5, label: 'Dengeli' },
            { value: 1, label: 'Yaratıcı' },
          ]}
          styles={{
            markLabel: { fontSize: 9, color: 'var(--mantine-color-gray-6)' },
          }}
        />
      </Box>

      {/* Verdict Weight (read-only info) */}
      <Box p="sm" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <Text size="xs" c="dimmed" mb={4}>
          Karar Ağırlığı
        </Text>
        <Text size="sm" c="white" fw={500}>
          %{Math.round(Number(verdictWeight ?? 0) * 100)}
        </Text>
      </Box>

      {/* System Prompt */}
      <Box p="sm" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <Text size="xs" c="dimmed" mb={6}>
          Uzman Prompt
        </Text>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.currentTarget.value)}
          minRows={6}
          maxRows={12}
          autosize
          size="xs"
          styles={{
            input: {
              background: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'var(--mantine-color-gray-3)',
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.6,
            },
          }}
        />
      </Box>

      {/* Save Button */}
      {hasChanges && (
        <Button
          color={agent.color}
          onClick={handleSave}
          loading={saving}
          leftSection={<IconCheck size={16} />}
          fullWidth
          size="sm"
        >
          Kaydet
        </Button>
      )}
    </>
  );
}
