import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import { AGENT_TOOLS } from '../constants';
import type { AgentPersona, ToolExecution, ToolResult } from '../types';

// ─── API Call ─────────────────────────────────────────────

async function executeAgentTool(
  agentId: string,
  toolId: string,
  tenderId: number,
  analysisContext: Record<string, unknown>,
  input?: string
): Promise<ToolResult> {
  const res = await api.post('/api/ai/ihale-masasi/agent-action', {
    agentId,
    toolId,
    tenderId,
    input,
    analysisContext,
  });

  if (!res.data?.success) throw new Error(res.data?.error || 'AI hatasi');
  return res.data.result;
}

// ─── Hook ──────────────────────────────────────────────────

interface UseAgentToolsOptions {
  tenderId?: number;
  analysisContext?: Record<string, unknown>;
  onToolComplete?: (agentId: AgentPersona['id'], toolId: string, result: ToolResult) => void;
}

export function useAgentTools(agentId: AgentPersona['id'], options?: UseAgentToolsOptions) {
  const [executions, setExecutions] = useState<Record<string, ToolExecution>>({});

  const agentTools = AGENT_TOOLS.filter((t) => t.agentId === agentId);

  const executeTool = useCallback(
    async (toolId: string, input?: string) => {
      setExecutions((prev) => ({
        ...prev,
        [toolId]: {
          toolId,
          status: 'generating',
          input,
          startedAt: new Date().toISOString(),
        },
      }));

      try {
        const result = await executeAgentTool(
          agentId,
          toolId,
          options?.tenderId ?? 0,
          options?.analysisContext ?? {},
          input
        );

        setExecutions((prev) => ({
          ...prev,
          [toolId]: {
            ...prev[toolId],
            status: 'complete',
            result,
          },
        }));

        options?.onToolComplete?.(agentId, toolId, result);
      } catch (err) {
        setExecutions((prev) => ({
          ...prev,
          [toolId]: {
            ...prev[toolId],
            status: 'error',
            error: (err as Error).message,
          },
        }));
      }
    },
    [agentId, options]
  );

  const clearResult = useCallback((toolId: string) => {
    setExecutions((prev) => {
      const next = { ...prev };
      delete next[toolId];
      return next;
    });
  }, []);

  const getExecution = useCallback((toolId: string): ToolExecution | undefined => executions[toolId], [executions]);

  return {
    agentTools,
    executions,
    executeTool,
    clearResult,
    getExecution,
  };
}
