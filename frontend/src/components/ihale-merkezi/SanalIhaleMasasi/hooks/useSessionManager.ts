import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import type { AgentAnalysis, SessionRecord, SnippetDrop, VerdictData } from '../types';

interface UseSessionManagerProps {
  tenderId: number | string;
  verdictData: VerdictData | null;
  snippetDrops: SnippetDrop[];
  agentAnalyses: AgentAnalysis[];
}

interface UseSessionManagerReturn {
  saving: boolean;
  sessions: SessionRecord[];
  sessionStartTime: number;
  saveSession: () => Promise<void>;
  fetchSessions: () => Promise<void>;
}

export function useSessionManager({
  tenderId,
  verdictData,
  snippetDrops,
  agentAnalyses,
}: UseSessionManagerProps): UseSessionManagerReturn {
  const [sessionStartTime] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  const saveSession = useCallback(async () => {
    setSaving(true);
    try {
      await api.post('/api/ai/ihale-masasi/session/save', {
        tenderId,
        sessionData: {
          verdictData,
          snippetDrops,
          agentAnalyses,
          duration: Math.floor((Date.now() - sessionStartTime) / 1000),
          savedAt: new Date().toISOString(),
        },
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [tenderId, verdictData, snippetDrops, agentAnalyses, sessionStartTime]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get(`/api/ai/ihale-masasi/session/${tenderId}`);
      if (res.data?.success) setSessions(res.data.sessions);
    } catch {
      // silently fail
    }
  }, [tenderId]);

  return {
    saving,
    sessions,
    sessionStartTime,
    saveSession,
    fetchSessions,
  };
}
