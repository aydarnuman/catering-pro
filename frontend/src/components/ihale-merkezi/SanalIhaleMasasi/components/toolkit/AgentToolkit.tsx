import { useMemo } from 'react';
import { Box, Divider, Stack, Text } from '@mantine/core';
import { IconTools } from '@tabler/icons-react';
import { useAgentTools } from '../../hooks/useAgentTools';
import type { AgentPersona, AgentTool, ToolResult } from '../../types';
import { DraftTool } from './DraftTool';
import { PrecedentTool } from './PrecedentTool';
import { RedlineTool } from './RedlineTool';
import { ToolButton } from './ToolButton';
import { ToolResultCard } from './ToolResultCard';

interface AgentToolkitProps {
  agent: AgentPersona;
  /** User-selected text from document (for tools requiring selection) */
  selectedText?: string;
  /** Tender ID for API calls */
  tenderId?: number;
  /** Analysis context from tender analysis_summary */
  analysisContext?: Record<string, unknown>;
  /** Days left until tender deadline — when <=3, urgency tools sort first */
  daysLeft?: number | null;
  /** Called when a tool completes — for auto-attaching results to orbit ring */
  onToolComplete?: (agentId: AgentPersona['id'], toolId: string, result: ToolResult) => void;
}

function sortByUrgency(tools: AgentTool[], isUrgent: boolean): AgentTool[] {
  if (!isUrgent) return tools;
  return [...tools].sort((a, b) => {
    const pa = a.urgencyPriority ?? 99;
    const pb = b.urgencyPriority ?? 99;
    return pa - pb;
  });
}

export function AgentToolkit({ agent, selectedText, tenderId, analysisContext, daysLeft, onToolComplete }: AgentToolkitProps) {
  const { agentTools, executeTool, clearResult, getExecution } = useAgentTools(agent.id, {
    tenderId,
    analysisContext,
    onToolComplete,
  });

  const isUrgent = typeof daysLeft === 'number' && daysLeft <= 3;
  const sortedTools = useMemo(() => sortByUrgency(agentTools, isUrgent), [agentTools, isUrgent]);

  if (sortedTools.length === 0) return null;

  // Separate completed results from pending tools
  const completedTools = sortedTools.filter((t) => getExecution(t.id)?.status === 'complete');

  return (
    <>
      <Divider color="dark.5" />

      <Stack gap={8}>
        {/* Toolkit header */}
        <Box
          px={4}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconTools size={14} color={`var(--mantine-color-${agent.color}-5)`} />
          <Text size="sm" fw={600} c={agent.color}>
            Araclar
          </Text>
        </Box>

        {/* Tool buttons */}
        {sortedTools.map((tool) => {
          const execution = getExecution(tool.id);
          const needsSelection = tool.requiresSelection && !selectedText;

          return (
            <ToolButton
              key={tool.id}
              tool={tool}
              execution={execution}
              disabled={needsSelection}
              onExecute={() => executeTool(tool.id, selectedText)}
            />
          );
        })}
      </Stack>

      {/* Results section */}
      {completedTools.length > 0 && (
        <>
          <Divider color="dark.5" />
          <Stack gap={8}>
            <Text size="xs" fw={600} c="dimmed" px={4}>
              Sonuclar ({completedTools.length})
            </Text>
            {completedTools.map((tool) => {
              const execution = getExecution(tool.id)!;
              const result = execution.result!;

              if (result.type === 'redline') {
                return (
                  <RedlineTool
                    key={tool.id}
                    result={result}
                    onClose={() => clearResult(tool.id)}
                  />
                );
              }
              if (result.type === 'precedent') {
                return (
                  <PrecedentTool
                    key={tool.id}
                    result={result}
                    onClose={() => clearResult(tool.id)}
                  />
                );
              }
              if (result.type === 'draft') {
                return (
                  <DraftTool
                    key={tool.id}
                    result={result}
                    onClose={() => clearResult(tool.id)}
                  />
                );
              }
              if (result.type === 'calculation' || result.type === 'generic') {
                return (
                  <ToolResultCard
                    key={tool.id}
                    title={tool.label}
                    color={agent.color}
                    onClose={() => clearResult(tool.id)}
                  >
                    <Text
                      size="xs"
                      c="gray.4"
                      style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                    >
                      {result.content || 'Sonuc olusturuldu.'}
                    </Text>
                  </ToolResultCard>
                );
              }
              return null;
            })}
          </Stack>
        </>
      )}
    </>
  );
}
