import { useCallback, useState } from 'react';
import { API_BASE_URL } from '@/lib/config';
import type { AgentAnalysis, SessionRecord, SnippetDrop, VerdictData } from '../types';

const API = `${API_BASE_URL}/api`;

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
      await fetch(`${API}/ai/ihale-masasi/session/save`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId,
          sessionData: {
            verdictData,
            snippetDrops,
            agentAnalyses,
            duration: Math.floor((Date.now() - sessionStartTime) / 1000),
            savedAt: new Date().toISOString(),
          },
        }),
      });
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }, [tenderId, verdictData, snippetDrops, agentAnalyses, sessionStartTime]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ai/ihale-masasi/session/${tenderId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) setSessions(data.sessions);
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
