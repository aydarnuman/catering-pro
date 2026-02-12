/**
 * useAgentRegistry Hook
 *
 * Merkezi agent registry'den agent ve tool verilerini çeker.
 * API başarısız olursa constants.ts'deki hardcoded verileri fallback olarak kullanır.
 */

import { useQuery } from '@tanstack/react-query';
import { type Agent, type AgentTool as ApiAgentTool, agentAPI } from '@/lib/api/services/agents';
import { AGENT_TOOLS, AGENTS } from '../constants';
import type { AgentPersona, AgentTool } from '../types';

// ─── Transform Functions ─────────────────────────────────────

/**
 * API'den gelen Agent verisini frontend AgentPersona formatına dönüştürür
 */
function transformToAgentPersona(agent: Agent, index: number): AgentPersona {
  // Hardcoded'dan görsel/pozisyon verileri al (bunlar UI-specific)
  const fallbackAgent = AGENTS.find((a) => a.id === agent.slug);

  return {
    id: agent.slug as AgentPersona['id'],
    name: agent.name,
    subtitle: agent.subtitle || fallbackAgent?.subtitle || '',
    color: agent.color || fallbackAgent?.color || 'gray',
    accentHex: agent.accent_hex || fallbackAgent?.accentHex || '#6b7280',
    iconName: (agent.icon || fallbackAgent?.iconName || 'robot') as AgentPersona['iconName'],
    // UI pozisyonlama bilgileri hardcoded'dan gelir
    orbitPosition: fallbackAgent?.orbitPosition || { top: '10%', left: '10%' },
    side: fallbackAgent?.side || 'left',
    assembleDelay: fallbackAgent?.assembleDelay ?? index * 0.1,
    assembleOffset: fallbackAgent?.assembleOffset || { x: 0, y: 0 },
    mobileOrder: fallbackAgent?.mobileOrder ?? index,
  };
}

/**
 * API'den gelen AgentTool verisini frontend AgentTool formatına dönüştürür
 */
function transformToAgentTool(tool: ApiAgentTool): AgentTool {
  return {
    id: tool.tool_slug,
    agentId: tool.agent_slug as AgentPersona['id'],
    label: tool.label,
    icon: tool.icon || 'tool',
    description: tool.description || '',
    requiresSelection: tool.requires_selection,
    urgencyPriority: tool.urgency_priority,
  };
}

// ─── Hook Interface ──────────────────────────────────────────

export interface UseAgentRegistryOptions {
  /** Context key to filter agents (default: 'ihale_masasi') */
  contextKey?: string;
  /** Whether to enable the query */
  enabled?: boolean;
}

export interface UseAgentRegistryResult {
  /** Agent listesi (DB'den veya fallback) */
  agents: AgentPersona[];
  /** Tool listesi (DB'den veya fallback) */
  tools: AgentTool[];
  /** Yükleniyor durumu */
  loading: boolean;
  /** Hata mesajı */
  error: Error | null;
  /** DB'den mi yoksa fallback'ten mi geldi */
  source: 'database' | 'fallback';
  /** Veriyi yeniden çek */
  refetch: () => void;
}

// ─── Main Hook ───────────────────────────────────────────────

export function useAgentRegistry(options: UseAgentRegistryOptions = {}): UseAgentRegistryResult {
  const { contextKey = 'ihale_masasi', enabled = true } = options;

  const query = useQuery({
    queryKey: ['agent-registry', contextKey],
    queryFn: async () => {
      const response = await agentAPI.getByContext(contextKey);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Agent verileri alınamadı');
      }

      return response.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 dakika cache
    gcTime: 30 * 60 * 1000, // 30 dakika garbage collection
    retry: 2,
    retryDelay: 1000,
  });

  // Transform API data or use fallback
  if (query.isSuccess && query.data) {
    const transformedAgents = query.data.agents.map((agent, index) =>
      transformToAgentPersona(agent, index)
    );
    const transformedTools = query.data.tools.map(transformToAgentTool);

    return {
      agents: transformedAgents,
      tools: transformedTools,
      loading: false,
      error: null,
      source: 'database',
      refetch: query.refetch,
    };
  }

  // Fallback to hardcoded constants
  return {
    agents: AGENTS,
    tools: AGENT_TOOLS,
    loading: query.isLoading,
    error: query.error as Error | null,
    source: 'fallback',
    refetch: query.refetch,
  };
}

export default useAgentRegistry;
